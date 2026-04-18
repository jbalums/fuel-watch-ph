import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
	OverlayViewF,
} from "@react-google-maps/api";
import { Clock3, Loader2, MapPinned, Navigation, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/app-toast";
import { openGoogleMapsDirections } from "@/lib/google-maps-directions";
import type { FuelType, GasStation } from "@/types/station";
import {
	fuelTypes,
	fuelTypeTextColorClassNames,
	isFuelSellable,
} from "@/lib/fuel-prices";
import {
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_CONTAINER_STYLE,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	MANILA_CENTER,
	type CoordinatePair,
} from "@/lib/google-maps";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useStationBrandLogos } from "@/hooks/useStationBrandLogos";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { detectGeoScopeFromAddress } from "@/lib/geo-detection";
import {
	buildResolvedStationMarkerIcon,
	buildStationBrandAverage,
} from "@/lib/station-brand-logos";
import {
	buildStationExperienceIdentityFromDiscoveredStation,
	buildStationExperienceIdentityFromStation,
	buildStationExperienceSearch,
} from "@/lib/station-experience";
import {
	buildAddressSearchText,
	getResolvedDiscoveredStationAddress,
	getDuplicateMatch,
	resolveDiscoveredStationAddress,
	searchDiscoveredFuelStationsInBounds,
	type DiscoveredStation,
} from "@/lib/station-discovery";
import {
	useMapAutoDiscoverFeature,
	useMapDirectionsFeature,
} from "@/hooks/useSystemFeatureFlags";
import { DiscoveredStationInfoWindow } from "./DiscoveredStationInfoWindow";
import { StationMarkerInfoWindow } from "./StationMarkerInfoWindow";
const DEFAULT_HIGHLIGHT_ZOOM = 15;
const DEFAULT_CURRENT_LOCATION_ZOOM = 15;
const DEFAULT_EMPTY_MAP_ZOOM = 15;
const DEFAULT_SINGLE_STATION_ZOOM = 15;
const FOCUSED_STATION_ZOOM = 16;

function hasAnyUsableStationPrice(station: GasStation) {
	return fuelTypes.some((fuelType) => {
		const price = station.prices[fuelType];
		return typeof price === "number" && Number.isFinite(price) && price > 0;
	});
}

type MapBounds = {
	north: number;
	south: number;
	east: number;
	west: number;
};

type RenderedRouteState = {
	destinationId: string;
	destinationName: string;
	result: google.maps.DirectionsResult;
	selectedRouteIndex: number;
};

interface StationMapProps {
	stations: GasStation[];
	allStations?: GasStation[];
	focusedStationId?: string | null;
	highlightLocation?: (CoordinatePair & { label?: string }) | null;
	onFocusedStationChange?: (stationId: string | null) => void;
	provinceCode?: string;
	cityMunicipalityCode?: string;
}

function GoogleStationMap({
	stations,
	allStations = stations,
	focusedStationId,
	highlightLocation,
	onFocusedStationChange,
	provinceCode = "",
	cityMunicipalityCode = "",
}: StationMapProps) {
	const navigate = useNavigate();
	const { isAdmin } = useUserAccess();
	const { data: mapDirectionsFeature } = useMapDirectionsFeature();
	const { data: mapAutoDiscoverFeature } = useMapAutoDiscoverFeature();
	const { data: stationBrandLogos = [] } = useStationBrandLogos();
	const { provinces, cities } = useGeoReferences({
		includeAllCities: true,
	});
	const [internalSelectedStationId, setInternalSelectedStationId] = useState<
		string | null
	>(null);
	const [selectedGoogleStation, setSelectedGoogleStation] =
		useState<DiscoveredStation | null>(null);
	const [discoveredStations, setDiscoveredStations] = useState<
		DiscoveredStation[]
	>([]);
	const [
		isResolvingSelectedDiscoveryAddress,
		setIsResolvingSelectedDiscoveryAddress,
	] = useState(false);
	const [selectedMapFuelType, setSelectedMapFuelType] =
		useState<FuelType>("Unleaded");
	const [isDiscovering, setIsDiscovering] = useState(false);
	const [map, setMap] = useState<google.maps.Map | null>(null);
	const [directionsRenderer, setDirectionsRenderer] =
		useState<google.maps.DirectionsRenderer | null>(null);
	const [renderedRoute, setRenderedRoute] =
		useState<RenderedRouteState | null>(null);
	const [visibleBounds, setVisibleBounds] = useState<MapBounds | null>(null);
	const [renderCenter, setRenderCenter] =
		useState<CoordinatePair>(MANILA_CENTER);
	const lastAutoFitKeyRef = useRef<string | null>(null);
	const lastDiscoveryBoundsKeyRef = useRef<string | null>(null);
	const discoverySearchTimeoutRef = useRef<number | null>(null);
	const closeInfoWindowTimeoutRef = useRef<number | null>(null);
	const discoveryRequestIdRef = useRef(0);
	const hasInitializedCenterRef = useRef(false);
	const { coordinates: currentLocation } = useCurrentLocation();
	const googleMaps =
		typeof window !== "undefined" ? window.google?.maps : undefined;
	const isInlineDirectionsEnabled = mapDirectionsFeature?.isEnabled ?? false;
	const isMapAutoDiscoverEnabled = mapAutoDiscoverFeature?.isEnabled ?? true;
	const selectedStationId =
		focusedStationId !== undefined
			? focusedStationId
			: internalSelectedStationId;
	const stationById = useMemo(
		() => new Map(stations.map((station) => [station.id, station])),
		[stations],
	);
	const focusedStation = useMemo(
		() =>
			selectedStationId
				? (stationById.get(selectedStationId) ?? null)
				: null,
		[selectedStationId, stationById],
	);
	const currentLocationIcon = useMemo(() => {
		if (!googleMaps) {
			return null;
		}

		return {
			path: googleMaps.SymbolPath.CIRCLE,
			scale: 12,
			fillColor: "#1d4fd7",
			fillOpacity: 1,
			strokeColor: "#d97706",
			strokeWeight: 2,
		} satisfies google.maps.Symbol;
	}, [googleMaps]);
	const highlightedLocationIcon = useMemo(() => {
		if (!googleMaps) {
			return null;
		}

		return {
			path: googleMaps.SymbolPath.CIRCLE,
			scale: 10,
			fillColor: "#f97316",
			fillOpacity: 1,
			strokeColor: "#ffffff",
			strokeWeight: 3,
		} satisfies google.maps.Symbol;
	}, [googleMaps]);
	const visibleStations = useMemo(() => {
		if (!googleMaps) {
			return [];
		}

		if (!visibleBounds) {
			return stations.map((station) => ({
				id: station.id,
				position: {
					lat: station.lat,
					lng: station.lng,
				},
				icon: buildResolvedStationMarkerIcon(
					googleMaps,
					{
						name: station.name,
						stationBrandLogoId: station.stationBrandLogoId,
					},
					stationBrandLogos,
				),
				price: station.prices[selectedMapFuelType],
				fuelAvailability: station.fuelAvailability[selectedMapFuelType],
			}));
		}

		return stations
			.filter((station) => {
				const { lat, lng } = station;

				return (
					lat <= visibleBounds.north &&
					lat >= visibleBounds.south &&
					lng <= visibleBounds.east &&
					lng >= visibleBounds.west
				);
			})
			.map((station) => ({
				id: station.id,
				position: {
					lat: station.lat,
					lng: station.lng,
				},
				icon: buildResolvedStationMarkerIcon(
					googleMaps,
					{
						name: station.name,
						stationBrandLogoId: station.stationBrandLogoId,
					},
					stationBrandLogos,
				),
				price: station.prices[selectedMapFuelType],
				fuelAvailability: station.fuelAvailability[selectedMapFuelType],
			}));
	}, [
		googleMaps,
		selectedMapFuelType,
		stationBrandLogos,
		stations,
		visibleBounds,
	]);
	const shouldShowFuelPriceBadges = !focusedStation && !selectedGoogleStation;
	const visibleStationPriceBadges = useMemo(() => {
		if (!shouldShowFuelPriceBadges) {
			return [];
		}

		return visibleStations
			.map((stationMarker) => {
				const hasPrice =
					typeof stationMarker.price === "number" &&
					Number.isFinite(stationMarker.price) &&
					stationMarker.price > 0;
				const priceStatus = stationMarker.fuelAvailability;

				if (!hasPrice || priceStatus === "Out") {
					return null;
				}

				if (priceStatus && !isFuelSellable(priceStatus)) {
					return null;
				}

				return {
					id: stationMarker.id,
					position: stationMarker.position,
					price: stationMarker.price,
				};
			})
			.filter(
				(
					stationMarker,
				): stationMarker is {
					id: string;
					position: CoordinatePair;
					price: number;
				} => Boolean(stationMarker),
			);
	}, [shouldShowFuelPriceBadges, visibleStations]);
	const filteredDiscoveredStations = useMemo(() => {
		return discoveredStations.filter((station) => {
			if (getDuplicateMatch(station, allStations)) {
				return false;
			}

			if (!provinceCode && !cityMunicipalityCode) {
				return true;
			}

			const detectedScope = detectGeoScopeFromAddress({
				address: buildAddressSearchText(station),
				provinces,
				cities,
			});

			if (provinceCode && detectedScope?.provinceCode !== provinceCode) {
				return false;
			}

			if (
				cityMunicipalityCode &&
				detectedScope?.cityMunicipalityCode !== cityMunicipalityCode
			) {
				return false;
			}

			return true;
		});
	}, [
		allStations,
		cities,
		cityMunicipalityCode,
		discoveredStations,
		provinceCode,
		provinces,
	]);
	const selectedStationPosition = useMemo(
		() =>
			focusedStation
				? {
						lat: focusedStation.lat,
						lng: focusedStation.lng,
					}
				: null,
		[focusedStation],
	);
	const selectedGoogleStationPosition = useMemo(
		() =>
			selectedGoogleStation
				? {
						lat: selectedGoogleStation.lat,
						lng: selectedGoogleStation.lng,
					}
				: null,
		[selectedGoogleStation],
	);
	const selectedGoogleStationBrandAverage = useMemo(
		() =>
			selectedGoogleStation
				? buildStationBrandAverage(
						{
							name: selectedGoogleStation.name,
							stationBrandLogoId: null,
						},
						allStations,
						stationBrandLogos,
					)
				: null,
		[allStations, selectedGoogleStation, stationBrandLogos],
	);
	const focusedStationBrandAverage = useMemo(() => {
		if (!focusedStation || hasAnyUsableStationPrice(focusedStation)) {
			return null;
		}

		return buildStationBrandAverage(
			{
				name: focusedStation.name,
				stationBrandLogoId: focusedStation.stationBrandLogoId,
			},
			allStations.filter((station) => station.id !== focusedStation.id),
			stationBrandLogos,
		);
	}, [allStations, focusedStation, stationBrandLogos]);
	const stationBoundsKey = useMemo(
		() =>
			stations
				.map(
					(station) =>
						`${station.id}:${station.lat.toFixed(6)},${station.lng.toFixed(6)}`,
				)
				.join("|"),
		[stations],
	);
	const highlightLocationKey = useMemo(
		() =>
			highlightLocation
				? `${highlightLocation.lat.toFixed(6)},${highlightLocation.lng.toFixed(6)}:${highlightLocation.label ?? ""}`
				: "none",
		[highlightLocation],
	);
	const currentLocationKey = useMemo(
		() =>
			currentLocation
				? `${currentLocation.lat.toFixed(6)},${currentLocation.lng.toFixed(6)}`
				: "none",
		[currentLocation],
	);
	const mapOptions = useMemo(
		() => ({
			fullscreenControl: true,
			mapTypeControl: true,
			streetViewControl: true,
			gestureHandling: "greedy" as const,
		}),
		[],
	);
	const routeOptions = useMemo(() => {
		if (!renderedRoute) {
			return [];
		}

		return renderedRoute.result.routes.map((route, index) => {
			const leg = route.legs[0];

			return {
				index,
				summary: route.summary?.trim() || `Route ${index + 1}`,
				distanceText: leg?.distance?.text ?? "Distance unavailable",
				durationText: leg?.duration?.text ?? "Duration unavailable",
			};
		});
	}, [renderedRoute]);
	const closeRenderedRoute = useCallback(() => {
		directionsRenderer?.setDirections({
			routes: [],
		} as google.maps.DirectionsResult);
		setRenderedRoute(null);
	}, [directionsRenderer]);
	const applyRenderedRouteIndex = useCallback(
		(routeIndex: number) => {
			if (!renderedRoute || !directionsRenderer || !map) {
				return;
			}

			directionsRenderer.setDirections(renderedRoute.result);
			directionsRenderer.setRouteIndex(routeIndex);
			setRenderedRoute((current) =>
				current
					? {
							...current,
							selectedRouteIndex: routeIndex,
						}
					: current,
			);

			const routeBounds = renderedRoute.result.routes[routeIndex]?.bounds;
			if (routeBounds) {
				map.fitBounds(routeBounds, 80);
			}
		},
		[directionsRenderer, map, renderedRoute],
	);
	const renderDirectionsToFocusedStation = useCallback(async () => {
		if (!googleMaps || !map || !focusedStation) {
			return false;
		}

		if (!currentLocation) {
			toast.info(
				"Current location is required to show directions on the map.",
			);
			return false;
		}

		const service = new googleMaps.DirectionsService();
		const nextRenderer =
			directionsRenderer ??
			new googleMaps.DirectionsRenderer({
				preserveViewport: false,
				suppressMarkers: false,
				hideRouteList: true,
				polylineOptions: {
					strokeColor: "#2563eb",
					strokeOpacity: 0.9,
					strokeWeight: 10,
				},
			});

		nextRenderer.setMap(map);
		if (!directionsRenderer) {
			setDirectionsRenderer(nextRenderer);
		}

		try {
			const result = await service.route({
				origin: currentLocation,
				destination: {
					lat: focusedStation.lat,
					lng: focusedStation.lng,
				},
				travelMode: googleMaps.TravelMode.DRIVING,
				provideRouteAlternatives: true,
			});

			nextRenderer.setDirections(result);
			nextRenderer.setRouteIndex(0);
			setRenderedRoute({
				destinationId: focusedStation.id,
				destinationName: focusedStation.name,
				result,
				selectedRouteIndex: 0,
			});

			const routeBounds = result.routes[0]?.bounds;
			if (routeBounds) {
				map.fitBounds(routeBounds, 80);
			}

			return true;
		} catch (error) {
			console.error("Failed to render map directions", error);
			toast.error("Directions could not be loaded on the map right now.");
			return false;
		}
	}, [currentLocation, directionsRenderer, focusedStation, googleMaps, map]);
	const openSelectedGoogleStationInDiscovery = useCallback(() => {
		if (!selectedGoogleStation) {
			return;
		}

		navigate("/admin/station-discovery", {
			state: {
				prefilledGoogleStation: selectedGoogleStation,
			},
		});
	}, [navigate, selectedGoogleStation]);
	const openSelectedGoogleStationExperiences = useCallback(() => {
		if (!selectedGoogleStation) {
			return;
		}

		const detectedScope = detectGeoScopeFromAddress({
			address: buildAddressSearchText(selectedGoogleStation),
			lat: selectedGoogleStation.lat,
			lng: selectedGoogleStation.lng,
			provinces,
			cities,
		});
		const identity = buildStationExperienceIdentityFromDiscoveredStation(
			selectedGoogleStation,
			detectedScope,
		);

		navigate(
			`/station-experiences${buildStationExperienceSearch(identity)}`,
		);
	}, [cities, navigate, provinces, selectedGoogleStation]);
	const reportSelectedGoogleStation = useCallback(() => {
		if (!selectedGoogleStation) {
			return;
		}

		navigate("/report", {
			state: {
				prefilledGoogleStation: selectedGoogleStation,
			},
		});
	}, [navigate, selectedGoogleStation]);
	const openFocusedStationExperiences = useCallback(() => {
		if (!focusedStation) {
			return;
		}

		const identity =
			buildStationExperienceIdentityFromStation(focusedStation);
		navigate(
			`/station-experiences${buildStationExperienceSearch(identity)}`,
		);
	}, [focusedStation, navigate]);
	const reportFocusedStation = useCallback(() => {
		if (!focusedStation) {
			return;
		}

		navigate("/report", {
			state: {
				prefilledStationId: focusedStation.id,
				prefilledSubmissionMode: "standard",
			},
		});
	}, [focusedStation, navigate]);
	const openFocusedStationInGoogleMaps = useCallback(() => {
		if (!focusedStation) {
			return;
		}

		openGoogleMapsDirections({
			lat: focusedStation.lat,
			lng: focusedStation.lng,
			placeId: focusedStation.googlePlaceId,
			originLat: currentLocation?.lat,
			originLng: currentLocation?.lng,
		});
	}, [currentLocation?.lat, currentLocation?.lng, focusedStation]);

	const setSelectedStationId = (stationId: string | null) => {
		setSelectedGoogleStation(null);

		if (onFocusedStationChange) {
			onFocusedStationChange(stationId);
			return;
		}

		setInternalSelectedStationId(stationId);
	};

	const handleSelectGoogleStation = useCallback(
		(station: DiscoveredStation | null) => {
			if (onFocusedStationChange) {
				onFocusedStationChange(null);
			} else {
				setInternalSelectedStationId(null);
			}

			setIsResolvingSelectedDiscoveryAddress(false);
			setSelectedGoogleStation(station);
		},
		[onFocusedStationChange],
	);

	useEffect(() => {
		if (!selectedGoogleStation) {
			return;
		}

		const cachedAddress = getResolvedDiscoveredStationAddress(
			selectedGoogleStation.externalId,
		);

		if (cachedAddress && cachedAddress === selectedGoogleStation.address) {
			setIsResolvingSelectedDiscoveryAddress(false);
			return;
		}

		let isActive = true;
		setIsResolvingSelectedDiscoveryAddress(true);

		void resolveDiscoveredStationAddress(selectedGoogleStation)
			.then((resolvedStation) => {
				if (!isActive) {
					return;
				}

				setDiscoveredStations((current) =>
					current.map((station) =>
						station.externalId === resolvedStation.externalId
							? resolvedStation
							: station,
					),
				);
				setSelectedGoogleStation((current) =>
					current?.externalId === resolvedStation.externalId
						? resolvedStation
						: current,
				);
			})
			.catch((error) => {
				if (!isActive) {
					return;
				}

				console.error(
					"Failed to reverse geocode selected discovered station",
					error,
				);
			})
			.finally(() => {
				if (!isActive) {
					return;
				}

				setIsResolvingSelectedDiscoveryAddress(false);
			});

		return () => {
			isActive = false;
		};
	}, [selectedGoogleStation]);

	const updateVisibleBounds = useCallback(() => {
		if (!map) {
			return;
		}

		const nextBounds = map.getBounds();
		if (!nextBounds) {
			return;
		}

		const northEast = nextBounds.getNorthEast();
		const southWest = nextBounds.getSouthWest();
		setVisibleBounds((currentBounds) => {
			const resolvedBounds = {
				north: northEast.lat(),
				south: southWest.lat(),
				east: northEast.lng(),
				west: southWest.lng(),
			};

			if (
				currentBounds &&
				currentBounds.north === resolvedBounds.north &&
				currentBounds.south === resolvedBounds.south &&
				currentBounds.east === resolvedBounds.east &&
				currentBounds.west === resolvedBounds.west
			) {
				return currentBounds;
			}

			return resolvedBounds;
		});
	}, [map]);

	const searchDiscoveredStations = useCallback(
		async (bounds: google.maps.LatLngBounds, boundsKey: string) => {
			setIsDiscovering(true);
			const requestId = ++discoveryRequestIdRef.current;

			try {
				const results =
					await searchDiscoveredFuelStationsInBounds(bounds);

				if (requestId !== discoveryRequestIdRef.current) {
					return;
				}

				setDiscoveredStations(results);
				lastDiscoveryBoundsKeyRef.current = boundsKey;
			} catch (error) {
				if (requestId !== discoveryRequestIdRef.current) {
					return;
				}

				console.error(
					"Failed to discover OpenStreetMap fuel stations",
					error,
				);
				setDiscoveredStations([]);
				// toast.error(
				// 	error instanceof Error
				// 		? error.message
				// 		: "OpenStreetMap discovery could not load stations right now.",
				// );
			} finally {
				if (requestId === discoveryRequestIdRef.current) {
					setIsDiscovering(false);
				}
			}
		},
		[],
	);

	const scheduleDiscoverySearch = useCallback(() => {
		if (!isMapAutoDiscoverEnabled) {
			return;
		}

		if (isDiscovering) {
			return;
		}

		if (!map) {
			return;
		}

		const bounds = map.getBounds();
		if (!bounds) {
			return;
		}

		const northEast = bounds.getNorthEast();
		const southWest = bounds.getSouthWest();
		const boundsKey = [
			northEast.lat().toFixed(4),
			northEast.lng().toFixed(4),
			southWest.lat().toFixed(4),
			southWest.lng().toFixed(4),
		].join("|");

		if (lastDiscoveryBoundsKeyRef.current === boundsKey) {
			return;
		}

		if (discoverySearchTimeoutRef.current !== null) {
			window.clearTimeout(discoverySearchTimeoutRef.current);
		}

		discoverySearchTimeoutRef.current = window.setTimeout(() => {
			searchDiscoveredStations(bounds, boundsKey);
		}, 1500);
	}, [
		isDiscovering,
		isMapAutoDiscoverEnabled,
		map,
		searchDiscoveredStations,
	]);

	useEffect(() => {
		if (!map) {
			return;
		}

		if (focusedStation) {
			return;
		}

		const nextAutoFitKey = `${stationBoundsKey}|${highlightLocationKey}|${stations.length === 0 ? currentLocationKey : "stations-present"}`;
		if (lastAutoFitKeyRef.current === nextAutoFitKey) {
			return;
		}

		lastAutoFitKeyRef.current = nextAutoFitKey;

		if (highlightLocation) {
			map.setCenter(highlightLocation);
			map.setZoom(DEFAULT_HIGHLIGHT_ZOOM);
			return;
		}

		if (stations.length === 0) {
			map.setCenter(currentLocation ?? MANILA_CENTER);
			map.setZoom(DEFAULT_EMPTY_MAP_ZOOM);
			return;
		}

		if (stations.length === 1) {
			// map.panTo({ lat: stations[0].lat, lng: stations[0].lng });
			// map.setZoom(DEFAULT_SINGLE_STATION_ZOOM);
			return;
		}

		if (!googleMaps) {
			return;
		}

		/* * * * commenting out auto-fit for now as it causes unwanted zooming when the station list updates or when the user clicks on a marker to view the info window. We can revisit this in the future and maybe add a button to allow users to manually trigger auto-fit if they want to. 
		 * Auto-fit to station markers *
		const bounds = new googleMaps.LatLngBounds();
		for (const station of stations) {
			bounds.extend({ lat: station.lat, lng: station.lng });
		}
		map.fitBounds(bounds, 80);
		* * * */
	}, [
		currentLocation,
		focusedStation,
		googleMaps,
		highlightLocation,
		highlightLocationKey,
		currentLocationKey,
		map,
		stationBoundsKey,
		stations,
	]);

	useEffect(() => {
		if (!focusedStation || !map) {
			return;
		}

		// map.panTo({
		// 	lat: focusedStation.lat,
		// 	lng: focusedStation.lng,
		// });
		// map.setZoom(FOCUSED_STATION_ZOOM);
	}, [focusedStation, map]);

	useEffect(() => {
		updateVisibleBounds();
	}, [updateVisibleBounds, stations, highlightLocation]);

	useEffect(() => {
		if (isMapAutoDiscoverEnabled) {
			return;
		}

		if (discoverySearchTimeoutRef.current !== null) {
			window.clearTimeout(discoverySearchTimeoutRef.current);
			discoverySearchTimeoutRef.current = null;
		}

		setDiscoveredStations([]);
		setSelectedGoogleStation(null);
		setIsDiscovering(false);
		lastDiscoveryBoundsKeyRef.current = null;
	}, [isMapAutoDiscoverEnabled]);

	useEffect(() => {
		if (!isDiscovering) {
			scheduleDiscoverySearch();
		}
	}, [isDiscovering, scheduleDiscoverySearch, visibleBounds]);

	useEffect(() => {
		return () => {
			if (discoverySearchTimeoutRef.current !== null) {
				window.clearTimeout(discoverySearchTimeoutRef.current);
			}

			if (closeInfoWindowTimeoutRef.current !== null) {
				window.clearTimeout(closeInfoWindowTimeoutRef.current);
			}

			directionsRenderer?.setMap(null);
		};
	}, [directionsRenderer]);

	useEffect(() => {
		if (isInlineDirectionsEnabled || !renderedRoute) {
			return;
		}

		closeRenderedRoute();
	}, [closeRenderedRoute, isInlineDirectionsEnabled, renderedRoute]);

	useEffect(() => {
		if (!focusedStation || !renderedRoute) {
			return;
		}

		if (focusedStation.id === renderedRoute.destinationId) {
			return;
		}

		setRenderedRoute(null);
	}, [focusedStation, renderedRoute]);

	useEffect(() => {
		if (focusedStation) {
			setRenderCenter({
				lat: focusedStation.lat,
				lng: focusedStation.lng,
			});
			hasInitializedCenterRef.current = true;
			return;
		}

		if (highlightLocation) {
			setRenderCenter(highlightLocation);
			hasInitializedCenterRef.current = true;
			return;
		}

		if (hasInitializedCenterRef.current) {
			return;
		}

		setRenderCenter(currentLocation ?? MANILA_CENTER);
		if (currentLocation) {
			hasInitializedCenterRef.current = true;
		}
	}, [currentLocation, focusedStation, highlightLocation]);

	useEffect(() => {
		if (!selectedGoogleStation) {
			return;
		}

		const stillVisible = filteredDiscoveredStations.some(
			(station) =>
				station.externalId === selectedGoogleStation.externalId,
		);

		if (!stillVisible) {
			setSelectedGoogleStation(null);
		}
	}, [filteredDiscoveredStations, selectedGoogleStation]);
	const showOnlyRoadsStyle = [
		{
			// 1. Hide every label on the map first
			featureType: "all",
			elementType: "labels",
			stylers: [{ visibility: "off" }],
		},
		{
			// 2. Turn road labels back on specifically
			featureType: "road",
			elementType: "labels",
			stylers: [{ visibility: "on" }],
		},
	];
	return (
		<div className="relative">
			<div className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] rounded-2xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
				<div className="flex max-w-full gap-1 overflow-x-auto">
					{fuelTypes.map((fuelType) => (
						<button
							key={`map-fuel-selector-${fuelType}`}
							type="button"
							onClick={() => setSelectedMapFuelType(fuelType)}
							className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-semibold sovereign-ease transition-colors ${
								selectedMapFuelType === fuelType
									? "bg-primary text-primary-foreground shadow-sm"
									: `bg-background/80 ${fuelTypeTextColorClassNames[fuelType]} hover:bg-secondary`
							}`}
							aria-pressed={selectedMapFuelType === fuelType}
						>
							{fuelType}
						</button>
					))}
				</div>
			</div>
			{isDiscovering ? (
				<div className="pointer-events-none absolute right-3 top-3 z-20">
					<div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur">
						<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
						Discovering stations...
					</div>
				</div>
			) : null}
			<GoogleMap
				mapContainerStyle={{
					// ...showOnlyRoadsStyle,
					...GOOGLE_MAPS_CONTAINER_STYLE,
					height: "calc(100dvh - 185px)",
				}}
				center={renderCenter}
				zoom={
					focusedStation
						? FOCUSED_STATION_ZOOM
						: DEFAULT_EMPTY_MAP_ZOOM
				}
				onLoad={(map) => {
					setMap(map);
				}}
				onUnmount={() => {
					setMap(null);
				}}
				onIdle={() => {
					updateVisibleBounds();
					scheduleDiscoverySearch();
				}}
				options={mapOptions}
			>
				{highlightLocation && (
					<>
						<MarkerF
							position={highlightLocation}
							icon={highlightedLocationIcon ?? undefined}
							zIndex={9_000}
						/>
						<OverlayViewF
							position={highlightLocation}
							mapPaneName="overlayMouseTarget"
							zIndex={9_001}
						>
							<div className="pointer-events-none -translate-x-1/2 -translate-y-full pb-3">
								<div className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
									{highlightLocation.label ??
										"Reported location"}
								</div>
							</div>
						</OverlayViewF>
					</>
				)}
				{currentLocation && (
					<>
						<MarkerF
							position={currentLocation}
							icon={currentLocationIcon ?? undefined}
							zIndex={10_000}
						/>
						<OverlayViewF
							position={currentLocation}
							mapPaneName="overlayMouseTarget"
							zIndex={10_001}
						>
							<div className="pointer-events-none -translate-x-1/2 -translate-y-full pb-3.5">
								<div className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-semibold text-white shadow-lg">
									You are here
								</div>
							</div>
						</OverlayViewF>
					</>
				)}
				{visibleStations.map((stationMarker) => (
					<MarkerF
						key={stationMarker.id}
						position={stationMarker.position}
						icon={stationMarker.icon ?? undefined}
						onClick={() => setSelectedStationId(stationMarker.id)}
					/>
				))}
				{visibleStationPriceBadges.map((stationMarker) => (
					<OverlayViewF
						key={`price-badge-${stationMarker.id}-${selectedMapFuelType}`}
						position={stationMarker.position}
						mapPaneName="overlayMouseTarget"
						zIndex={4_200}
					>
						<div className="pointer-events-none -translate-x-1/2 -translate-y-full pb-9">
							<div
								className={`whitespace-nowrap rounded-full border border-white/80 bg-black px-2.5 py-1 text-[11px] font-bold shadow-lg backdrop-blur ${fuelTypeTextColorClassNames[selectedMapFuelType]}`}
							>
								₱{stationMarker.price.toFixed(2)}
							</div>
						</div>
					</OverlayViewF>
				))}
				{filteredDiscoveredStations.map((station) => (
					<MarkerF
						key={`discovered-${station.externalId}`}
						position={{ lat: station.lat, lng: station.lng }}
						icon={
							googleMaps
								? buildResolvedStationMarkerIcon(
										googleMaps,
										{
											name: station.name,
											stationBrandLogoId: null,
										},
										stationBrandLogos,
									)
								: undefined
						}
						onClick={() => handleSelectGoogleStation(station)}
						zIndex={4_500}
					/>
				))}
				{focusedStation && selectedStationPosition ? (
					<InfoWindowF
						position={selectedStationPosition}
						onCloseClick={() => {
							setSelectedStationId(null);
						}}
					>
						<StationMarkerInfoWindow
							station={focusedStation}
							brandAverage={focusedStationBrandAverage}
							showDirectionsAction={isInlineDirectionsEnabled}
							showOpenInMapsAction
							showReportAction
							onOpenInMaps={openFocusedStationInGoogleMaps}
							onGetDirections={async () => {
								const didRenderRoute =
									await renderDirectionsToFocusedStation();
								if (!didRenderRoute) {
									return;
								}

								if (
									closeInfoWindowTimeoutRef.current !== null
								) {
									window.clearTimeout(
										closeInfoWindowTimeoutRef.current,
									);
								}

								closeInfoWindowTimeoutRef.current =
									window.setTimeout(() => {
										setSelectedStationId(null);
										closeInfoWindowTimeoutRef.current =
											null;
									}, 500);
							}}
							onReportFuelPrices={reportFocusedStation}
							onOpenExperiences={openFocusedStationExperiences}
						/>
					</InfoWindowF>
				) : null}
				{selectedGoogleStation && selectedGoogleStationPosition ? (
					<InfoWindowF
						position={selectedGoogleStationPosition}
						onCloseClick={() => handleSelectGoogleStation(null)}
					>
						<DiscoveredStationInfoWindow
							station={selectedGoogleStation}
							brandAverage={selectedGoogleStationBrandAverage}
							isResolvingAddress={
								isResolvingSelectedDiscoveryAddress
							}
							showAdminAction={isAdmin}
							onOpenInDiscovery={
								openSelectedGoogleStationInDiscovery
							}
							showReportAction
							onReportGasStation={reportSelectedGoogleStation}
							onOpenExperiences={
								openSelectedGoogleStationExperiences
							}
						/>
					</InfoWindowF>
				) : null}
			</GoogleMap>
			{renderedRoute && routeOptions.length > 0 ? (
				<div className="pointer-events-auto absolute right-4 bottom-4 z-20 w-[min(360px,calc(100%-2rem))] rounded-2xl border-2 border-primary bg-card/95 p-4 shadow-sovereign backdrop-blur">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-semibold text-foreground">
								Routes to {renderedRoute.destinationName}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Choose a route to compare distance and travel
								time.
							</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0"
							onClick={closeRenderedRoute}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<div className="mt-3 flex flex-col gap-2">
						{routeOptions.map((routeOption) => {
							const isSelected =
								renderedRoute.selectedRouteIndex ===
								routeOption.index;

							return (
								<button
									key={`${renderedRoute.destinationId}-${routeOption.index}`}
									type="button"
									onClick={() =>
										applyRenderedRouteIndex(
											routeOption.index,
										)
									}
									className={`rounded-xl border px-3 py-3 text-left transition-colors ${
										isSelected
											? "border-primary bg-primary/10"
											: "border-border bg-background hover:bg-secondary/40"
									}`}
								>
									<div className="flex items-center justify-between gap-3">
										<div className="min-w-0">
											<p className="flex items-center gap-2 text-sm font-medium text-foreground">
												<Route className="h-4 w-4 shrink-0 text-primary" />
												<span className="truncate">
													{routeOption.summary}
												</span>
											</p>
											<p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
												<span className="inline-flex items-center gap-1">
													<Navigation className="h-3.5 w-3.5" />
													{routeOption.distanceText}
												</span>
												<span className="inline-flex items-center gap-1">
													<Clock3 className="h-3.5 w-3.5" />
													{routeOption.durationText}
												</span>
											</p>
										</div>
										{isSelected ? (
											<span className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
												Showing
											</span>
										) : null}
									</div>
								</button>
							);
						})}
					</div>
				</div>
			) : null}
		</div>
	);
}

export function StationMap({
	stations,
	allStations,
	focusedStationId,
	highlightLocation,
	onFocusedStationChange,
	provinceCode,
	cityMunicipalityCode,
}: StationMapProps) {
	if (!GOOGLE_MAPS_API_KEY) {
		return (
			<div className="rounded-2xl border border-border bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<MapPinned className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Google Maps is not configured
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Add `VITE_GOOGLE_MAPS_API_KEY` to your environment
							to load the station map.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-2xl border border-border shadow-sovereign">
			<LoadScriptNext
				id={GOOGLE_MAPS_SCRIPT_ID}
				googleMapsApiKey={GOOGLE_MAPS_API_KEY}
				libraries={GOOGLE_MAPS_LIBRARIES}
				loadingElement={
					<div className="flex h-[calc(100dvh-185px)] items-center justify-center bg-card">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				}
			>
				<GoogleStationMap
					stations={stations}
					allStations={allStations}
					focusedStationId={focusedStationId}
					highlightLocation={highlightLocation}
					onFocusedStationChange={onFocusedStationChange}
					provinceCode={provinceCode}
					cityMunicipalityCode={cityMunicipalityCode}
				/>
			</LoadScriptNext>
		</div>
	);
}

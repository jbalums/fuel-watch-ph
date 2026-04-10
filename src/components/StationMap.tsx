import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
	OverlayViewF,
} from "@react-google-maps/api";
import { Loader2, MapPinned } from "lucide-react";
import type { GasStation } from "@/types/station";
import { fuelTypes } from "@/lib/fuel-prices";
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
	buildAddressSearchText,
	getDuplicateMatch,
	searchGoogleFuelStationsInBounds,
	type GoogleDiscoveredStation,
} from "@/lib/station-discovery";
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
	const { data: stationBrandLogos = [] } = useStationBrandLogos();
	const { provinces, cities } = useGeoReferences({
		includeAllCities: true,
	});
	const [internalSelectedStationId, setInternalSelectedStationId] = useState<
		string | null
	>(null);
	const [selectedGoogleStation, setSelectedGoogleStation] =
		useState<GoogleDiscoveredStation | null>(null);
	const [discoveredStations, setDiscoveredStations] = useState<
		GoogleDiscoveredStation[]
	>([]);
	const [map, setMap] = useState<google.maps.Map | null>(null);
	const [visibleBounds, setVisibleBounds] = useState<MapBounds | null>(null);
	const [renderCenter, setRenderCenter] =
		useState<CoordinatePair>(MANILA_CENTER);
	const lastAutoFitKeyRef = useRef<string | null>(null);
	const lastDiscoveryBoundsKeyRef = useRef<string | null>(null);
	const discoverySearchTimeoutRef = useRef<number | null>(null);
	const discoveryRequestIdRef = useRef(0);
	const hasInitializedCenterRef = useRef(false);
	const { coordinates: currentLocation } = useCurrentLocation();
	const googleMaps =
		typeof window !== "undefined" ? window.google?.maps : undefined;
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
			}));
	}, [googleMaps, stationBrandLogos, stations, visibleBounds]);
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

	const setSelectedStationId = (stationId: string | null) => {
		setSelectedGoogleStation(null);

		if (onFocusedStationChange) {
			onFocusedStationChange(stationId);
			return;
		}

		setInternalSelectedStationId(stationId);
	};

	const handleSelectGoogleStation = useCallback(
		(station: GoogleDiscoveredStation | null) => {
			if (onFocusedStationChange) {
				onFocusedStationChange(null);
			} else {
				setInternalSelectedStationId(null);
			}

			setSelectedGoogleStation(station);
		},
		[onFocusedStationChange],
	);

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
			const requestId = ++discoveryRequestIdRef.current;

			try {
				const results = await searchGoogleFuelStationsInBounds(bounds);

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
					"Failed to discover Google-only fuel stations",
					error,
				);
				setDiscoveredStations([]);
			}
		},
		[],
	);

	const scheduleDiscoverySearch = useCallback(() => {
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
		}, 500);
	}, [map, searchDiscoveredStations]);

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
			map.panTo({ lat: stations[0].lat, lng: stations[0].lng });
			map.setZoom(DEFAULT_SINGLE_STATION_ZOOM);
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

		map.panTo({
			lat: focusedStation.lat,
			lng: focusedStation.lng,
		});
		map.setZoom(FOCUSED_STATION_ZOOM);
	}, [focusedStation, map]);

	useEffect(() => {
		updateVisibleBounds();
	}, [updateVisibleBounds, stations, highlightLocation]);

	useEffect(() => {
		return () => {
			if (discoverySearchTimeoutRef.current !== null) {
				window.clearTimeout(discoverySearchTimeoutRef.current);
			}
		};
	}, []);

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
			(station) => station.placeId === selectedGoogleStation.placeId,
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
		<GoogleMap
			mapContainerStyle={{
				// ...showOnlyRoadsStyle,
				...GOOGLE_MAPS_CONTAINER_STYLE,
				height: "calc(100dvh - 185px)",
			}}
			center={renderCenter}
			zoom={
				focusedStation ? FOCUSED_STATION_ZOOM : DEFAULT_EMPTY_MAP_ZOOM
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
								{highlightLocation.label ?? "Reported location"}
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
			{filteredDiscoveredStations.map((station) => (
				<MarkerF
					key={`google-discovered-${station.placeId}`}
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
						showDirectionsAction
						showReportAction
						onReportFuelPrices={reportFocusedStation}
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
						showAdminAction={isAdmin}
						onOpenInDiscovery={openSelectedGoogleStationInDiscovery}
						showReportAction
						onReportGasStation={reportSelectedGoogleStation}
					/>
				</InfoWindowF>
			) : null}
		</GoogleMap>
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

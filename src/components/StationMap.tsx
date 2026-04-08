import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
	OverlayViewF,
} from "@react-google-maps/api";
import { Loader2, MapPinned } from "lucide-react";
import type { GasStation, StationStatus } from "@/types/station";
import {
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_CONTAINER_STYLE,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	MANILA_CENTER,
	type CoordinatePair,
} from "@/lib/google-maps";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { StationMarkerInfoWindow } from "./StationMarkerInfoWindow";
import fuelwatchicon from "@/assets/images/map-pin-icon.png";
const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};
const DEFAULT_HIGHLIGHT_ZOOM = 15;
const DEFAULT_CURRENT_LOCATION_ZOOM = 15;
const DEFAULT_EMPTY_MAP_ZOOM = 15;
const DEFAULT_SINGLE_STATION_ZOOM = 15;
const FOCUSED_STATION_ZOOM = 16;

type MapBounds = {
	north: number;
	south: number;
	east: number;
	west: number;
};

interface StationMapProps {
	stations: GasStation[];
	focusedStationId?: string | null;
	highlightLocation?: (CoordinatePair & { label?: string }) | null;
	onFocusedStationChange?: (stationId: string | null) => void;
}

function GoogleStationMap({
	stations,
	focusedStationId,
	highlightLocation,
	onFocusedStationChange,
}: StationMapProps) {
	const [internalSelectedStationId, setInternalSelectedStationId] = useState<
		string | null
	>(null);
	const [map, setMap] = useState<google.maps.Map | null>(null);
	const [visibleBounds, setVisibleBounds] = useState<MapBounds | null>(null);
	const lastAutoFitKeyRef = useRef<string | null>(null);
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
	const mapCenter =
		focusedStation ?? highlightLocation ?? currentLocation ?? MANILA_CENTER;
	const markerIcons = useMemo(() => {
		if (!googleMaps) {
			return null;
		}

		return {
			Available: {
				path: googleMaps.SymbolPath.CIRCLE,
				scale: 12,
				fillColor: statusColors.Available,
				fillOpacity: 1,
				strokeColor: "#1d4fd7",
				strokeWeight: 1,
			},
			Low: {
				path: googleMaps.SymbolPath.CIRCLE,
				scale: 12,
				fillColor: statusColors.Low,
				fillOpacity: 1,
				strokeColor: "#ffffff",
				strokeWeight: 1,
			},
			Out: {
				path: googleMaps.SymbolPath.CIRCLE,
				scale: 12,
				fillColor: statusColors.Out,
				fillOpacity: 1,
				strokeColor: "#ffffff",
				strokeWeight: 1,
			},
		} satisfies Record<StationStatus, google.maps.Symbol>;
	}, [googleMaps]);
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
		if (!visibleBounds) {
			return stations.map((station) => ({
				id: station.id,
				position: {
					lat: station.lat,
					lng: station.lng,
				},
				icon: markerIcons?.[station.status],
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
				icon: {
					url: fuelwatchicon,
					scaledSize: new googleMaps.Size(45, 40),
					anchor: new googleMaps.Point(22.5, 35),
				},
				// icon: markerIcons?.[station.status],
			}));
	}, [markerIcons, stations, visibleBounds]);
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

	const setSelectedStationId = (stationId: string | null) => {
		if (onFocusedStationChange) {
			onFocusedStationChange(stationId);
			return;
		}

		setInternalSelectedStationId(stationId);
	};

	const restoreDefaultMapView = useCallback(() => {
		if (!map) {
			return;
		}
		map.setZoom(DEFAULT_CURRENT_LOCATION_ZOOM);
		return;
		lastAutoFitKeyRef.current = null;

		if (highlightLocation) {
			map.panTo(highlightLocation);
			map.setZoom(DEFAULT_HIGHLIGHT_ZOOM);
			return;
		}

		if (currentLocation) {
			map.panTo(currentLocation);
			map.setZoom(DEFAULT_CURRENT_LOCATION_ZOOM);
			return;
		}

		if (stations.length === 0) {
			map.setCenter(MANILA_CENTER);
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
	}, [currentLocation, googleMaps, highlightLocation, map, stations]);

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

	return (
		<GoogleMap
			mapContainerStyle={{
				...GOOGLE_MAPS_CONTAINER_STYLE,
				height: "calc(100dvh - 185px)",
			}}
			center={mapCenter}
			zoom={
				focusedStation ? FOCUSED_STATION_ZOOM : DEFAULT_EMPTY_MAP_ZOOM
			}
			onLoad={(map) => {
				setMap(map);
			}}
			onUnmount={() => {
				setMap(null);
			}}
			onIdle={updateVisibleBounds}
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
			{focusedStation && selectedStationPosition ? (
				<InfoWindowF
					position={selectedStationPosition}
					onCloseClick={() => {
						setSelectedStationId(null);
						restoreDefaultMapView();
					}}
				>
					<StationMarkerInfoWindow
						station={focusedStation}
						showDirectionsAction
					/>
				</InfoWindowF>
			) : null}
		</GoogleMap>
	);
}

export function StationMap({
	stations,
	focusedStationId,
	highlightLocation,
	onFocusedStationChange,
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
					focusedStationId={focusedStationId}
					highlightLocation={highlightLocation}
					onFocusedStationChange={onFocusedStationChange}
				/>
			</LoadScriptNext>
		</div>
	);
}

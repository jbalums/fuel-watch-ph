import { useEffect, useMemo, useState } from "react";
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
} from "@/lib/google-maps";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { StationMarkerInfoWindow } from "./StationMarkerInfoWindow";

const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};
interface StationMapProps {
	stations: GasStation[];
	focusedStationId?: string | null;
	onFocusedStationChange?: (stationId: string | null) => void;
}

function GoogleStationMap({
	stations,
	focusedStationId,
	onFocusedStationChange,
}: StationMapProps) {
	const [internalSelectedStationId, setInternalSelectedStationId] = useState<
		string | null
	>(null);
	const [map, setMap] = useState<google.maps.Map | null>(null);
	const { coordinates: currentLocation } = useCurrentLocation();
	const selectedStationId =
		focusedStationId !== undefined
			? focusedStationId
			: internalSelectedStationId;
	const focusedStation = useMemo(
		() =>
			selectedStationId
				? stations.find((station) => station.id === selectedStationId) ??
					null
				: null,
		[selectedStationId, stations],
	);
	const mapCenter = focusedStation
		? { lat: focusedStation.lat, lng: focusedStation.lng }
		: currentLocation ?? MANILA_CENTER;

	const setSelectedStationId = (stationId: string | null) => {
		if (onFocusedStationChange) {
			onFocusedStationChange(stationId);
			return;
		}

		setInternalSelectedStationId(stationId);
	};

	useEffect(() => {
		if (!map) {
			return;
		}

		if (focusedStation) {
			return;
		}

		if (currentLocation) {
			map.setCenter(currentLocation);
			map.setZoom(15);
			return;
		}

		if (stations.length === 0) {
			map.setCenter(MANILA_CENTER);
			map.setZoom(14);
			return;
		}

		if (stations.length === 1) {
			map.panTo({ lat: stations[0].lat, lng: stations[0].lng });
			map.setZoom(16);
			return;
		}

		const bounds = new window.google.maps.LatLngBounds();
		for (const station of stations) {
			bounds.extend({ lat: station.lat, lng: station.lng });
		}
		map.fitBounds(bounds, 80);
	}, [currentLocation, focusedStation, map, stations]);

	useEffect(() => {
		if (!focusedStation || !map) {
			return;
		}

		map.panTo({
			lat: focusedStation.lat,
			lng: focusedStation.lng,
		});
		map.setZoom(17);
	}, [focusedStation, map]);

	const createMarkerIcon = (status: StationStatus): google.maps.Symbol => ({
		path: window.google.maps.SymbolPath.CIRCLE,
		scale: 12,
		fillColor: statusColors[status],
		fillOpacity: 1,
		strokeColor: "#ffffff",
		strokeWeight: 1,
	});

	const createCurrentLocationIcon = (): google.maps.Symbol => ({
		path: window.google.maps.SymbolPath.CIRCLE,
		scale: 10,
		fillColor: "#2563eb",
		fillOpacity: 1,
		strokeColor: "#ffffff",
		strokeWeight: 3,
	});

	return (
		<GoogleMap
			mapContainerStyle={{
				...GOOGLE_MAPS_CONTAINER_STYLE,
				height: "calc(100dvh - 185px)",
			}}
			center={mapCenter}
			zoom={focusedStation ? 17 : 18}
			onLoad={(map) => {
				setMap(map);
			}}
			onUnmount={() => {
				setMap(null);
			}}
			options={{
				fullscreenControl: true,
				mapTypeControl: true,
				streetViewControl: true,
				gestureHandling: "greedy",
			}}
		>
			{currentLocation && (
				<>
					<MarkerF
						position={currentLocation}
						icon={createCurrentLocationIcon()}
						zIndex={10_000}
					/>
					<OverlayViewF
						position={currentLocation}
						mapPaneName="overlayMouseTarget"
						zIndex={10_001}
					>
						<div className="pointer-events-none -translate-x-1/2 -translate-y-full pb-3">
							<div className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
								You are here
							</div>
						</div>
					</OverlayViewF>
				</>
			)}
			{stations.map((station) => (
				<MarkerF
					key={station.id}
					position={{ lat: station.lat, lng: station.lng }}
					icon={createMarkerIcon(station.status)}
					onClick={() => setSelectedStationId(station.id)}
				>
					{selectedStationId === station.id && (
						<InfoWindowF
							position={{ lat: station.lat, lng: station.lng }}
							onCloseClick={() => setSelectedStationId(null)}
						>
							<StationMarkerInfoWindow station={station} />
						</InfoWindowF>
					)}
				</MarkerF>
			))}
		</GoogleMap>
	);
}

export function StationMap({
	stations,
	focusedStationId,
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
					onFocusedStationChange={onFocusedStationChange}
				/>
			</LoadScriptNext>
		</div>
	);
}

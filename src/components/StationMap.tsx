import { useEffect, useRef, useState } from "react";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
} from "@react-google-maps/api";
import { Loader2, MapPinned } from "lucide-react";
import type { FuelType, GasStation, StationStatus } from "@/types/station";
import { toast } from "sonner";
import {
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_CONTAINER_STYLE,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	MANILA_CENTER,
} from "@/lib/google-maps";

const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};
const fuelTypes: FuelType[] = ["Unleaded", "Premium", "Diesel"];
const fuelTypeColors: string[] = [
	"text-green-600",
	"text-red-600",
	"text-amber-600",
];
interface StationMapProps {
	stations: GasStation[];
}

function GoogleStationMap({ stations }: StationMapProps) {
	const [center, setCenter] = useState(MANILA_CENTER);
	const [hasUserLocation, setHasUserLocation] = useState(false);
	const [selectedStationId, setSelectedStationId] = useState<string | null>(
		null,
	);
	const mapRef = useRef<google.maps.Map | null>(null);

	useEffect(() => {
		if (!navigator.geolocation) {
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				setCenter({
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				});
				setHasUserLocation(true);
			},
			() => {
				toast.error("Could not detect location");
			},
		);
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) {
			return;
		}

		if (hasUserLocation) {
			map.setCenter(center);
			map.setZoom(15);
			return;
		}

		if (stations.length === 0) {
			map.setCenter(center);
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
	}, [center, hasUserLocation, stations]);

	useEffect(() => {
		if (!selectedStationId || !mapRef.current) {
			return;
		}

		const selectedStation = stations.find(
			(station) => station.id === selectedStationId,
		);
		if (!selectedStation) {
			return;
		}

		mapRef.current.panTo({
			lat: selectedStation.lat,
			lng: selectedStation.lng,
		});
	}, [selectedStationId, stations]);

	const createMarkerIcon = (status: StationStatus): google.maps.Symbol => ({
		path: window.google.maps.SymbolPath.CIRCLE,
		scale: 10,
		fillColor: statusColors[status],
		fillOpacity: 1,
		strokeColor: "#ffffff",
		strokeWeight: 2,
	});

	return (
		<GoogleMap
			mapContainerStyle={{
				...GOOGLE_MAPS_CONTAINER_STYLE,
				height: "calc(100dvh - 185px)",
			}}
			center={center}
			zoom={18}
			onLoad={(map) => {
				mapRef.current = map;
			}}
			onUnmount={() => {
				mapRef.current = null;
			}}
			options={{
				fullscreenControl: true,
				mapTypeControl: true,
				streetViewControl: true,
				gestureHandling: "greedy",
			}}
		>
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
							<div className="flex min-w-[180px] flex-col gap-1.5 text-sm">
								<span className="font-semibold !text-black">
									{station.name}
								</span>
								<span className="text-xs text-gray-500">
									{station.address}
								</span>
								{fuelTypes.map((fueltype, index) => {
									return (
										<div
											className={`mt-1 flex items-center justify-between`}
											key={`station-map-fuel-type-${fueltype}`}
										>
											<span
												className={`text-base font-bold ${fuelTypeColors[index]} w-1/3`}
											>
												{fueltype}
											</span>
											<span
												className={`text-base font-bold ${fuelTypeColors[index]} w-1/3 text-right`}
											>
												{station.status === "Out"
													? "—"
													: `₱${station.prices[fueltype] > 0 ? station.prices[fueltype].toFixed(2) : "--.--"}`}
											</span>
											<span
												className="rounded-full px-2 py-0.5 text-xs min-w-16"
												style={{
													backgroundColor:
														statusColors[
															station.prices[
																fueltype
															] > 0
																? station.status
																: "Out"
														] + "22",
													color: statusColors[
														station.prices[
															fueltype
														] > 0
															? station.status
															: "Out"
													],
												}}
											>
												{station.prices[fueltype] > 0
													? station.status
													: ""}
											</span>
										</div>
									);
								})}

								<span className="text-xs text-gray-400">
									{station.lastUpdated}
								</span>
							</div>
						</InfoWindowF>
					)}
				</MarkerF>
			))}
		</GoogleMap>
	);
}

export function StationMap({ stations }: StationMapProps) {
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
				<GoogleStationMap stations={stations} />
			</LoadScriptNext>
		</div>
	);
}

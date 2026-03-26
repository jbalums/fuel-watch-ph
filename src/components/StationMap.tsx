import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GasStation } from "@/types/station";
import { toast } from "sonner";
import L from "leaflet";
import {
	CARTO_LIGHT_TILE_URL,
	createPinIcon,
	MANILA_CENTER,
	OSM_ATTRIBUTION,
} from "@/lib/leaflet";

const statusColors = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
} as const;

function FitBounds({ stations }: { stations: GasStation[] }) {
	const map = useMap();
	useEffect(() => {
		if (stations.length === 0) return;
		const bounds = L.latLngBounds(stations.map((s) => [s.lat, s.lng]));
		map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
	}, [stations, map]);
	return null;
}

interface StationMapProps {
	stations: GasStation[];
}

export function StationMap({ stations }: StationMapProps) {
	const [center, setCenter] = useState<[number, number]>(MANILA_CENTER);

	const handleDetectLocation = () => {
		if (!navigator.geolocation) {
			toast.error("Geolocation not supported");
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setCenter([pos.coords.latitude, pos.coords.longitude]);
				toast.success("Location detected!");
			},
			() => {
				toast.error("Could not detect location");
			},
		);
	};

	useEffect(() => {
		handleDetectLocation();
	}, []);

	return (
		<div className="overflow-hidden rounded-2xl border border-border shadow-sovereign">
			<MapContainer
				key={`map-center-${center[0]}`}
				center={center}
				zoom={12}
				scrollWheelZoom
				className="h-[75vh] w-full"
				style={{ background: "hsl(222 47% 11%)" }}
			>
				<TileLayer
					attribution={OSM_ATTRIBUTION}
					url={CARTO_LIGHT_TILE_URL}
				/>
				<FitBounds stations={stations} />
				{stations.map((station) => (
					<Marker
						key={station.id}
						position={[station.lat, station.lng]}
						icon={createPinIcon(statusColors[station.status])}
					>
						<Popup className="station-popup">
							<div className="flex flex-col gap-1.5 text-sm min-w-[180px]">
								<span className="font-semibold">
									{station.name}
								</span>
								<span className="text-xs text-gray-500">
									{station.address}
								</span>
								<div className="flex items-center justify-between mt-1">
									<span className="font-bold text-base">
										{station.status === "Out"
											? "—"
											: `₱${station.pricePerLiter.toFixed(2)}`}
									</span>
									<span
										className="text-xs px-2 py-0.5 rounded-full"
										style={{
											backgroundColor:
												statusColors[station.status] +
												"22",
											color: statusColors[station.status],
										}}
									>
										{station.status}
									</span>
								</div>
								<span className="text-xs text-gray-400">
									{station.fuelType} · {station.lastUpdated}
								</span>
							</div>
						</Popup>
					</Marker>
				))}
			</MapContainer>
		</div>
	);
}

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GasStation } from "@/types/station";
import { StatusBadge } from "./StatusBadge";
import { toast } from "sonner";

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;

const statusColors = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
} as const;

function createPinIcon(color: string) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
	return L.divIcon({
		html: svg,
		className: "",
		iconSize: [28, 40],
		iconAnchor: [14, 40],
		popupAnchor: [0, -40],
	});
}

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
	// const center: [number, number] = [14.5995, 120.9842]; // Manila
	const [center, setCenter] = useState([14.5995, 120.9842]);

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
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
					url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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

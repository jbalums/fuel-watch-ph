import type { FuelType, GasStation, StationStatus } from "@/types/station";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";

const fuelTypes: FuelType[] = ["Unleaded", "Premium", "Diesel"];
const fuelTypeColors = ["text-green-600", "text-red-600", "text-amber-600"];
const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};

export function StationMarkerInfoWindow({
	station,
}: {
	station: GasStation;
}) {
	return (
		<div className="flex min-w-[180px] flex-col gap-1.5 text-sm">
			<span className="font-semibold !text-black">{station.name}</span>
			<span className="text-xs text-gray-500">{station.address}</span>
			{(station.isLguVerified || station.isVerified) && (
				<div className="mt-1 flex flex-wrap items-center gap-1.5">
					{station.isLguVerified && (
						<LguVerifiedBadge className="bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-700" />
					)}
					{station.isVerified && (
						<VerifiedStationBadge className="px-2 py-0.5 text-[11px]" />
					)}
				</div>
			)}
			{fuelTypes.map((fuelType, index) => {
				const price = station.prices[fuelType];
				const hasPrice =
					typeof price === "number" &&
					Number.isFinite(price) &&
					price > 0;
				const priceStatus = hasPrice ? station.status : "Out";

				return (
					<div
						key={`station-info-${station.id}-${fuelType}`}
						className="mt-1 flex items-center justify-between"
					>
						<span
							className={`w-1/3 text-base font-bold ${fuelTypeColors[index]}`}
						>
							{fuelType}
						</span>
						<span
							className={`w-1/3 text-right text-base font-bold ${fuelTypeColors[index]}`}
						>
							{station.status === "Out"
								? "—"
								: `₱${hasPrice ? price.toFixed(2) : "--.--"}`}
						</span>
						<span
							className="min-w-16 rounded-full px-2 py-0.5 text-xs"
							style={{
								backgroundColor: `${statusColors[priceStatus]}22`,
								color: statusColors[priceStatus],
							}}
						>
							{hasPrice ? station.status : ""}
						</span>
					</div>
				);
			})}

			<span className="text-xs text-gray-400">{station.lastUpdated}</span>
		</div>
	);
}

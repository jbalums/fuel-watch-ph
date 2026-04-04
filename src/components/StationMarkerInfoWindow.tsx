import type { GasStation, StationStatus } from "@/types/station";
import { Button } from "@/components/ui/button";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { PriceTrendIndicator } from "@/components/PriceTrendIndicator";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import {
	buildGoogleMapsDirectionsUrl,
	openGoogleMapsDirections,
} from "@/lib/google-maps-directions";
import { fuelTypes, fuelTypeTextColorClassNames } from "@/lib/fuel-prices";
import { Navigation } from "lucide-react";
const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};

interface StationMarkerInfoWindowProps {
	station: GasStation;
	showDirectionsAction?: boolean;
}

export function StationMarkerInfoWindow({
	station,
	showDirectionsAction = false,
}: StationMarkerInfoWindowProps) {
	const directionsUrl = buildGoogleMapsDirectionsUrl({
		lat: station.lat,
		lng: station.lng,
		placeId: station.googlePlaceId,
	});

	return (
		<div className="flex max-w-[288px] flex-col gap-1.5 text-sm pr-3">
			<span className="font-semibold !text-black pr-4">
				{station.name}
			</span>
			<span className="text-xs text-gray-500 whitespace-normal pr-4">
				{station.address}
			</span>
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

			{fuelTypes.map((fuelType) => {
				const price = station.prices[fuelType];
				const hasPrice =
					typeof price === "number" &&
					Number.isFinite(price) &&
					price > 0;
				const priceStatus = hasPrice ? station.status : "Out";

				return (
					<div
						key={`station-info-${station.id}-${fuelType}`}
						className={`mt-3 flex items-center justify-between ${hasPrice ? "" : "hidden"}`}
					>
						<span
							className={`w-[45%] text-xs font-semibold ${fuelTypeTextColorClassNames[fuelType]}`}
						>
							{fuelType}
						</span>
						<div
							className={`w-[30%] text-right text-sm font-bold ${fuelTypeTextColorClassNames[fuelType]}`}
						>
							<div className="flex items-center relative">
								<div className="absolute -bottom-4">
									<PriceTrendIndicator
										delta={
											station.status === "Out" ||
											!hasPrice
												? null
												: station.priceTrends[fuelType]
										}
										className="mt-0.5 text-[10px]"
									/>
								</div>
								<span>
									{station.status === "Out"
										? "—"
										: `₱${hasPrice ? price.toFixed(2) : "--.--"}`}
								</span>
							</div>
						</div>
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
			{showDirectionsAction ? (
				<Button
					type="button"
					variant="default"
					size="sm"
					className="mt-2 h-6 w-full justify-center text-xs"
					onClick={() => {
						openGoogleMapsDirections({
							lat: station.lat,
							lng: station.lng,
							placeId: station.googlePlaceId,
						});
					}}
					disabled={!directionsUrl}
				>
					<Navigation className="h-4 w-4" />
					Get Directions
				</Button>
			) : null}
			<span className="text-xs text-gray-400">{station.lastUpdated}</span>
		</div>
	);
}

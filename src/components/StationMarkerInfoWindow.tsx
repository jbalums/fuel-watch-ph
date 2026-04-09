import { memo } from "react";
import type { GasStation, StationStatus } from "@/types/station";
import { Button } from "@/components/ui/button";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { PriceTrendIndicator } from "@/components/PriceTrendIndicator";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import {
	buildGoogleMapsDirectionsUrl,
	openGoogleMapsDirections,
} from "@/lib/google-maps-directions";
import {
	fuelTypes,
	fuelTypeTextColorClassNames,
	isFuelSellable,
} from "@/lib/fuel-prices";
import { Navigation } from "lucide-react";
const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};

interface StationMarkerInfoWindowProps {
	station: GasStation;
	showDirectionsAction?: boolean;
	showReportAction?: boolean;
	onReportFuelPrices?: () => void;
}

export const StationMarkerInfoWindow = memo(function StationMarkerInfoWindow({
	station,
	showDirectionsAction = false,
	showReportAction = false,
	onReportFuelPrices,
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
				const priceStatus =
					station.fuelAvailability[fuelType] ??
					(hasPrice ? station.status : null);
				const shouldShowRow = priceStatus !== null || hasPrice;

				return (
					<div
						key={`station-info-${station.id}-${fuelType}`}
						className={`mt-3 flex items-center justify-between ${shouldShowRow ? "" : "hidden"}`}
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
											!isFuelSellable(priceStatus) ||
											!hasPrice
												? null
												: station.priceTrends[fuelType]
										}
										className="mt-0.5 text-[10px]"
									/>
								</div>
								<span>
									{priceStatus === "Out"
										? "—"
										: hasPrice
											? `₱${price.toFixed(2)}`
											: "--.--"}
								</span>
							</div>
						</div>
						{priceStatus ? (
							<span
								className="min-w-16 rounded-full px-2 py-0.5 text-xs"
								style={{
									backgroundColor: `${statusColors[priceStatus]}22`,
									color: statusColors[priceStatus],
								}}
							>
								{priceStatus}
							</span>
						) : null}
					</div>
				);
			})}
			{showReportAction || showDirectionsAction ? (
				<div className="mt-2 flex flex-col gap-2">
					{showReportAction && onReportFuelPrices ? (
						<Button
							type="button"
							variant="outlineprimary"
							size="sm"
							className="mt-5 mb-2 h-8 w-full justify-center text-xs"
							onClick={onReportFuelPrices}
						>
							Report Fuel Prices!
						</Button>
					) : null}
					{showDirectionsAction ? (
						<Button
							type="button"
							variant="default"
							size="sm"
							className="h-8 w-full justify-center text-xs"
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
				</div>
			) : null}
			<span className="text-xs text-gray-400">{station.lastUpdated}</span>
		</div>
	);
});

import { memo } from "react";
import type { GasStation, StationStatus } from "@/types/station";
import { Button } from "@/components/ui/button";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { PriceTrendIndicator } from "@/components/PriceTrendIndicator";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import type { StationBrandAverage } from "@/lib/station-brand-logos";
import {
	buildGoogleMapsDirectionsUrl,
	openGoogleMapsDirections,
} from "@/lib/google-maps-directions";
import {
	fuelTypes,
	fuelTypeTextColorClassNames,
	isFuelSellable,
} from "@/lib/fuel-prices";
import { FileEdit, FilePlus2Icon, Navigation } from "lucide-react";
const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};

interface StationMarkerInfoWindowProps {
	station: GasStation;
	brandAverage?: StationBrandAverage | null;
	showDirectionsAction?: boolean;
	showOpenInMapsAction?: boolean;
	showReportAction?: boolean;
	onReportFuelPrices?: () => void;
	onGetDirections?: () => void;
	onOpenInMaps?: () => void;
}

export const StationMarkerInfoWindow = memo(function StationMarkerInfoWindow({
	station,
	brandAverage = null,
	showDirectionsAction = false,
	showOpenInMapsAction = showDirectionsAction,
	showReportAction = false,
	onReportFuelPrices,
	onGetDirections,
	onOpenInMaps,
}: StationMarkerInfoWindowProps) {
	const directionsUrl = buildGoogleMapsDirectionsUrl({
		lat: station.lat,
		lng: station.lng,
		placeId: station.googlePlaceId,
	});

	return (
		<div className="flex max-w-[288px] flex-col gap-1.5 pr-3 md:pr-0 text-sm">
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
			{brandAverage ? (
				<div className="mt-3 rounded-lg border border-border bg-slate-100 px-3 py-2 text-xs text-muted-foreground dark:border-slate-300">
					<div className="font-medium text-indigo-700">
						Average from other <u>{brandAverage.brandName}</u>{" "}
						stations
					</div>
					<p className="mt-0.5 text-[11px] text-muted-foreground">
						Based on {brandAverage.sampleCount} station
						{brandAverage.sampleCount === 1 ? "" : "s"}
					</p>
					{fuelTypes.some(
						(fuelType) =>
							typeof brandAverage.averagePrices[fuelType] ===
							"number",
					) ? (
						<>
							<div className="mb-2 mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
								{fuelTypes.map((fuelType) => {
									const averagePrice =
										brandAverage.averagePrices[fuelType];
									if (
										typeof averagePrice !== "number" ||
										!Number.isFinite(averagePrice) ||
										averagePrice <= 0
									) {
										return null;
									}

									return (
										<div key={fuelType} className="min-w-0">
											<p
												className={`text-[12px] font-medium ${fuelTypeTextColorClassNames[fuelType]}`}
											>
												{fuelType}
											</p>
											<p className="text-[16px] font-semibold text-black">
												₱ {averagePrice.toFixed(2)}
											</p>
										</div>
									);
								})}
							</div>
							<span className="text-[10px] text-red-700">
								Disclaimer: Prices are for reference only and
								may not reflect current market prices.
							</span>
						</>
					) : (
						<p className="mt-2 text-[11px]">
							No similar listed stations with price data yet.
						</p>
					)}
				</div>
			) : null}
			{showReportAction ||
			showDirectionsAction ||
			showOpenInMapsAction ? (
				<div className="-mt-1 flex flex-col gap-2 px-1">
					{showReportAction && onReportFuelPrices ? (
						<Button
							type="button"
							variant="destructive"
							size="sm"
							className="mt-5 mb-0 h-8 w-full justify-center text-xs"
							onClick={onReportFuelPrices}
						>
							<FilePlus2Icon className="h-4 w-4" />
							Report Fuel Prices!
						</Button>
					) : null}
					{showOpenInMapsAction || showDirectionsAction ? (
						<div
							className={
								showOpenInMapsAction && showDirectionsAction
									? "grid grid-cols-2 gap-2"
									: "grid grid-cols-1 gap-2"
							}
						>
							{showOpenInMapsAction ? (
								<Button
									type="button"
									variant="outline-primary"
									size="sm"
									className="h-8 w-full justify-center text-xs"
									onClick={() => {
										if (onOpenInMaps) {
											onOpenInMaps();
											return;
										}

										if (onGetDirections) {
											openGoogleMapsDirections({
												lat: station.lat,
												lng: station.lng,
												placeId: station.googlePlaceId,
											});
											return;
										}

										openGoogleMapsDirections({
											lat: station.lat,
											lng: station.lng,
											placeId: station.googlePlaceId,
										});
									}}
									disabled={!directionsUrl}
								>
									<Navigation className="h-4 w-4" />
									{showDirectionsAction
										? "Open in Maps"
										: "Get Directions"}
								</Button>
							) : null}
							{showDirectionsAction ? (
								<Button
									type="button"
									variant="outlineprimary"
									size="sm"
									className="h-8 w-full transition-all duration-200 justify-center text-xs"
									onClick={() => {
										if (onGetDirections) {
											onGetDirections();
											return;
										}

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
				</div>
			) : null}
			<span className="text-xs text-gray-400 mt-1 mb-1">
				Last updated: {station.lastUpdated}
			</span>
		</div>
	);
});

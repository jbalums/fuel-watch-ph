import { memo } from "react";
import type { GasStation, StationStatus } from "@/types/station";
import { Button } from "@/components/ui/button";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { PriceTrendIndicator } from "@/components/PriceTrendIndicator";
import { StationExperiencePreview } from "@/components/StationExperiencePreview";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import type { StationBrandAverage } from "@/lib/station-brand-logos";
import { buildStationExperienceIdentityFromStation } from "@/lib/station-experience";
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
	onOpenExperiences?: () => void;
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
	onOpenExperiences,
}: StationMarkerInfoWindowProps) {
	const directionsUrl = buildGoogleMapsDirectionsUrl({
		lat: station.lat,
		lng: station.lng,
		placeId: station.googlePlaceId,
	});
	const experienceIdentity =
		buildStationExperienceIdentityFromStation(station);
	const hasSelectedStationPrices = fuelTypes.some((fuelType) => {
		const price = station.prices[fuelType];
		return typeof price === "number" && Number.isFinite(price) && price > 0;
	});

	return (
		<div className="flex flex-wrap max-w-[288px] flex-col gap-1.5 pr-3 md:pr-0 text-sm">
			<span className="font-semibold text-black dark:text-white pr-8 line-clamp-2">
				{station.name}
			</span>
			<span className="text-[8px] text-gray-500 leading-tight line-clamp-2">
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

			{hasSelectedStationPrices ? (
				<div className="rounded-sm border border-border dark:border-slate-600 bg-slate-100 dark:bg-slate-900 px py-2 text-xs text-muted-foreground flex flex-col">
					<div className="font-medium text-center text-indigo-700 dark:text-sky-400">
						Selected Station Prices
					</div>

					<div className="grid grid-cols-1 pt-2 mb-1">
						{fuelTypes.map((fuelType) => {
							const price = station.prices[fuelType];
							const hasPrice =
								typeof price === "number" &&
								Number.isFinite(price) &&
								price > 0;
							const priceStatus =
								station.fuelAvailability[fuelType] ??
								(hasPrice ? station.status : null);

							if (!hasPrice) {
								return null;
							}

							return (
								<div
									key={`station-info-${station.id}-${fuelType}`}
									className="flex items-center border-t justify-center last:border-b bg-white dark:bg-slate-950 py-2 px-3"
								>
									<span
										className={`w-full text-xs font-semibold ${fuelTypeTextColorClassNames[fuelType]}`}
									>
										{fuelType == "Premium Diesel" ? (
											<span>
												<span className="block -mt-1 -mb-1 text-[8px]">
													Premium
												</span>
												<span>Diesel</span>
											</span>
										) : (
											fuelType
										)}
									</span>
									<div
										className={`flex text-left text-sm font-bold text-black dark:text-white items-center justify-center`}
									>
										<div className="flex items-center relative">
											<span>
												{priceStatus === "Out"
													? "—"
													: hasPrice
														? `₱${price.toFixed(2)}`
														: "--.--"}
											</span>
										</div>

										{!isFuelSellable(priceStatus) ||
										!hasPrice ? (
											<div className="h-3 w-16"></div>
										) : (
											<div className="mt-8 w-16 flex items-center justify-center absolute">
												<PriceTrendIndicator
													delta={
														!isFuelSellable(
															priceStatus,
														) || !hasPrice
															? null
															: station
																	.priceTrends[
																	fuelType
																]
													}
													className="-mt-2 text-[8px]"
												/>
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>

					<span className="text-[10px] italic text-gray-400 -mb-1 text-center">
						Last updated: <b>{station.lastUpdated}</b>
					</span>
				</div>
			) : null}
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
				<div className="flex flex-wrap gap-2 px-[2px]">
					{onOpenExperiences ? (
						<Button
							type="button"
							variant="outline-primary"
							size="sm"
							className="h-8 justify-center text-[10px]"
							onClick={onOpenExperiences}
						>
							<FileEdit className="h-4 w-4" />
							Share experience!
						</Button>
					) : null}
					{showReportAction && onReportFuelPrices ? (
						<Button
							type="button"
							variant="destructive"
							size="sm"
							className="mb-0 h-8 justify-center text-[10px]"
							onClick={onReportFuelPrices}
						>
							<FilePlus2Icon className="h-4 w-4" />
							Fuel Prices!
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
									className="h-8 w-full justify-center text-[10px]"
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
									className="h-8 w-full transition-all duration-200 justify-center text-[10px]"
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
		</div>
	);
});

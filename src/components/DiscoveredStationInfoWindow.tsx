import { Button } from "@/components/ui/button";
import { fuelTypes, fuelTypeTextColorClassNames } from "@/lib/fuel-prices";
import type { StationBrandAverage } from "@/lib/station-brand-logos";
import type { GoogleDiscoveredStation } from "@/lib/station-discovery";
import { BadgePlus, MapPinned } from "lucide-react";

interface DiscoveredStationInfoWindowProps {
	station: GoogleDiscoveredStation;
	brandAverage?: StationBrandAverage | null;
	showAdminAction?: boolean;
	onOpenInDiscovery?: () => void;
	showReportAction?: boolean;
	onReportGasStation?: () => void;
}

export function DiscoveredStationInfoWindow({
	station,
	brandAverage = null,
	showAdminAction = false,
	onOpenInDiscovery,
	showReportAction = false,
	onReportGasStation,
}: DiscoveredStationInfoWindowProps) {
	return (
		<div className="flex max-w-[288px] flex-col gap-2 pr-3 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-semibold !text-black pr-2">
					{station.name}
				</span>
				<span className="rounded-full bg-accent/10 px-2 py-0 text-[8px] font-medium text-accent">
					Google Maps
				</span>
			</div>
			<span className="text-xs text-gray-500 whitespace-normal pr-4">
				{station.address}
			</span>
			<div className="rounded-lg border border-border dark:border-slate-300 bg-slate-100 px-3 py-2 text-xs text-muted-foreground">
				<div className="flex items-center gap-2 font-medium text-amber-600">
					<MapPinned className="h-3.5 w-3.5" />
					Not yet added to FuelWatch PH
				</div>
				<p className="mt-1">
					Lat {station.lat.toFixed(6)}, Lng {station.lng.toFixed(6)}
				</p>
			</div>
			{brandAverage ? (
				<div className="rounded-lg border border-border dark:border-slate-300 bg-slate-100 px-3 py-2 text-xs text-muted-foreground">
					<div className="font-medium text-indigo-700">
						Average from similar stations
					</div>
					{/* <p className="mt-1 font-medium text-black">
						{brandAverage.brandName} average
					</p> */}
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
							<div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
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
												className={`text-[11px] font-medium ${fuelTypeTextColorClassNames[fuelType]}`}
											>
												{fuelType}
											</p>
											<p className="text-[11px] font-semibold text-black">
												₱ {averagePrice.toFixed(2)}
											</p>
										</div>
									);
								})}
							</div>
							<span className="text-red-700 text-[10px]">
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
			<div className="mt-1 flex flex-col gap-2">
				{showReportAction && onReportGasStation ? (
					<Button
						type="button"
						variant="default"
						size="sm"
						className="h-8 w-full justify-center text-xs"
						onClick={onReportGasStation}
					>
						Report Fuel Prices!
					</Button>
				) : null}
				{showAdminAction && onOpenInDiscovery ? (
					<Button
						type="button"
						variant="default"
						size="sm"
						className="h-8 w-full justify-center text-xs"
						onClick={onOpenInDiscovery}
					>
						<BadgePlus className="h-4 w-4" />
						Open in Station Discovery
					</Button>
				) : null}
			</div>
		</div>
	);
}

import { Button } from "@/components/ui/button";
import { fuelTypes, fuelTypeTextColorClassNames } from "@/lib/fuel-prices";
import type { StationBrandAverage } from "@/lib/station-brand-logos";
import type { DiscoveredStation } from "@/lib/station-discovery";
import {
	BadgePlus,
	FilePlus2Icon,
	Info,
	MapPinned,
	MessageCircleMore,
} from "lucide-react";

interface DiscoveredStationInfoWindowProps {
	station: DiscoveredStation;
	brandAverage?: StationBrandAverage | null;
	isResolvingAddress?: boolean;
	showAdminAction?: boolean;
	onOpenInDiscovery?: () => void;
	showReportAction?: boolean;
	onReportGasStation?: () => void;
	onOpenExperiences?: () => void;
}

export function DiscoveredStationInfoWindow({
	station,
	brandAverage = null,
	isResolvingAddress = false,
	showAdminAction = false,
	onOpenInDiscovery,
	showReportAction = false,
	onReportGasStation,
	onOpenExperiences,
}: DiscoveredStationInfoWindowProps) {
	const hasActions =
		(showReportAction && onReportGasStation) ||
		onOpenExperiences ||
		(showAdminAction && onOpenInDiscovery);

	return (
		<div className="flex max-w-[288px] flex-col gap-2 pr-3 md:pr-0 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-semibold dark:text-white text-black pr-2">
					{station.name}
				</span>
				<span className="rounded-full bg-accent/10 px-2 py-0 text-[8px] font-medium text-accent">
					OpenStreetMap
				</span>
			</div>
			<span className="line-clamp-2 whitespace-normal pr-4 text-[8px] leading-3 text-gray-500">
				{station.address}
			</span>
			{isResolvingAddress ? (
				<span className="text-[11px] text-muted-foreground">
					Resolving address...
				</span>
			) : null}
			<div className="rounded-lg border border-border bg-slate-100 px-3 py-2 text-xs text-muted-foreground dark:border-slate-700 dark:bg-slate-950">
				<div className="flex items-center gap-2 font-medium text-amber-600">
					<MapPinned className="h-3.5 w-3.5" />
					Not yet added to FuelWatch PH
				</div>
				<p className="mt-1 text-[10px]">
					Lat {station.lat.toFixed(6)}, Lng {station.lng.toFixed(6)}
				</p>
			</div>
			{brandAverage ? (
				<div className="rounded-sm border border-border bg-slate-100 py-2 text-xs text-muted-foreground dark:border-slate-600 dark:bg-slate-900">
					<div className="text-center font-medium text-indigo-700 dark:text-sky-400">
						Average from other <u>{brandAverage.brandName}</u>{" "}
						stations
					</div>
					<p className="mt-0.5 text-center text-[10px] text-muted-foreground">
						Based on {brandAverage.sampleCount} station
						{brandAverage.sampleCount === 1 ? "" : "s"}
					</p>
					{fuelTypes.some(
						(fuelType) =>
							typeof brandAverage.averagePrices[fuelType] ===
							"number",
					) ? (
						<>
							<div className="mb-2 mt-2 grid grid-cols-1">
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
										<div
											key={fuelType}
											className="flex items-center justify-center border-t bg-white px-3 py-2 last:border-b dark:bg-slate-950"
										>
											<p
												className={`w-full text-sm font-semibold ${fuelTypeTextColorClassNames[fuelType]}`}
											>
												{fuelType}
											</p>
											<p className="whitespace-nowrap text-sm font-bold text-black dark:text-white">
												₱ {averagePrice.toFixed(2)}
											</p>
										</div>
									);
								})}
							</div>
							<span className="flex items-center gap-1 text-[9px] leading-none text-amber-600 w-full text-center justify-center">
								<Info className="text-amber-600 h-3 w-3" />{" "}
								Prices may not reflect current market prices.
							</span>
						</>
					) : (
						<p className="mt-2 text-center text-[12px]">
							No similar listed stations with price data yet.
						</p>
					)}
				</div>
			) : null}
			{hasActions ? (
				<div className="grid grid-cols-2 gap-2 px-[2px] pb-1 pt-2">
					{showReportAction && onReportGasStation ? (
						<div className="col-span-2 flex flex-col">
							<Button
								type="button"
								variant="amber"
								size="sm"
								className="mb-0 h-8 justify-center text-[10px]"
								onClick={onReportGasStation}
							>
								<FilePlus2Icon className="h-3 w-3" />
								Report Price • Help Others
							</Button>
							<span className="text-center text-[10px] italic">
								Takes less than 10 seconds
							</span>
						</div>
					) : null}
					{onOpenExperiences ? (
						<Button
							type="button"
							variant="outline-primary"
							size="sm"
							className="h-7 justify-center text-[10px]"
							onClick={onOpenExperiences}
						>
							<MessageCircleMore className="h-4 w-4" />
							Write Feedback
						</Button>
					) : null}
					{showAdminAction && onOpenInDiscovery ? (
						<Button
							type="button"
							variant="default"
							size="sm"
							className="h-7 justify-center text-[10px]"
							onClick={onOpenInDiscovery}
						>
							<BadgePlus className="h-4 w-4" />
							Open Discovery
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}

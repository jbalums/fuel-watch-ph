import { Button } from "@/components/ui/button";
import type { GoogleDiscoveredStation } from "@/lib/station-discovery";
import { BadgePlus, MapPinned } from "lucide-react";

interface DiscoveredStationInfoWindowProps {
	station: GoogleDiscoveredStation;
	showAdminAction?: boolean;
	onOpenInDiscovery?: () => void;
	showReportAction?: boolean;
	onReportGasStation?: () => void;
}

export function DiscoveredStationInfoWindow({
	station,
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
				<span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
					Google Maps only
				</span>
			</div>
			<span className="text-xs text-gray-500 whitespace-normal pr-4">
				{station.address}
			</span>
			<div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
				<div className="flex items-center gap-2 font-medium text-foreground">
					<MapPinned className="h-3.5 w-3.5" />
					Not yet added to FuelWatch PH
				</div>
				<p className="mt-1">
					Lat {station.lat.toFixed(6)}, Lng {station.lng.toFixed(6)}
				</p>
			</div>
			<div className="mt-1 flex flex-col gap-2">
				{showReportAction && onReportGasStation ? (
					<Button
						type="button"
						variant="default"
						size="sm"
						className="h-8 w-full justify-center text-xs"
						onClick={onReportGasStation}
					>
						Report Gas Station
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

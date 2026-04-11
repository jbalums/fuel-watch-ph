import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { FilterFuelType, GasStation } from "@/types/station";
import { StationCard } from "@/components/StationCard";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Button } from "@/components/ui/button";

interface StationResultsListProps {
	stations: GasStation[];
	brandAverageSourceStations?: GasStation[];
	loading: boolean;
	emptyMessage?: string;
	emptyActionLabel?: string;
	onEmptyAction?: () => void;
	currentPage?: number;
	totalPages?: number;
	onPageChange?: (page: number) => void;
	openOnMapInNewTab?: boolean;
	hideDistanceLabel?: boolean;
	activeFuelFilter?: FilterFuelType;
	showBrandAverageFallback?: boolean;
}

export function StationResultsList({
	stations,
	brandAverageSourceStations = [],
	loading,
	emptyMessage = "No stations found matching your criteria.",
	emptyActionLabel,
	onEmptyAction,
	currentPage = 1,
	totalPages = 1,
	onPageChange,
	openOnMapInNewTab = false,
	hideDistanceLabel = false,
	activeFuelFilter = "All",
	showBrandAverageFallback = false,
}: StationResultsListProps) {
	const { latitude, longitude } = useUserLocation();
	const userLocation = useMemo(
		() =>
			latitude !== null && longitude !== null
				? {
						lat: latitude,
						lng: longitude,
					}
				: null,
		[latitude, longitude],
	);
	const showPagination = !loading && totalPages > 1;
	const renderPagination = () => (
		<div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => {
					if (currentPage > 1) {
						onPageChange?.(currentPage - 1);
					}
				}}
				disabled={currentPage === 1}
				className="h-8 px-2 text-sm"
			>
				<ChevronLeft className="h-4 w-4" />
				Prev&nbsp;
			</Button>
			<span className="text-center text-xs flex items-center gap-2">
				Page{" "}
				<span className="font-bold text-sm dark:text-white">
					{currentPage}
				</span>{" "}
				of{" "}
				<span className="dark:text-white font-bold text-sm">
					{totalPages}
				</span>{" "}
				pages
			</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => {
					if (currentPage < totalPages) {
						onPageChange?.(currentPage + 1);
					}
				}}
				disabled={currentPage === totalPages}
				className="h-8 px-2 text-sm"
			>
				Next
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
	return (
		<div className="flex flex-col gap-3">
			{loading ? (
				<div className="flex items-center justify-center py-24">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{stations.map((station, index) => (
						<StationCard
							key={station.id}
							station={station}
							index={index}
							userLocation={userLocation}
							brandAverageSourceStations={brandAverageSourceStations}
							openOnMapInNewTab={openOnMapInNewTab}
							hideDistanceLabel={hideDistanceLabel}
							activeFuelFilter={activeFuelFilter}
							showBrandAverageFallback={showBrandAverageFallback}
						/>
					))}
					{stations.length === 0 && (
						<div className="col-span-full flex flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
							<p className="max-w-xl text-sm text-muted-foreground">
								{emptyMessage}
							</p>
							{emptyActionLabel && onEmptyAction ? (
								<Button
									type="button"
									size="lg"
									onClick={onEmptyAction}
									className="min-h-14 rounded-2xl px-8 text-base font-semibold shadow-lg shadow-primary/20"
								>
									{emptyActionLabel}
								</Button>
							) : null}
						</div>
					)}
				</div>
			)}
			{showPagination && renderPagination()}

			<p className="text-sm dark:text-amber-500 text-red-600 text-center">
				⚠️ Fuel prices are crowd-sourced and may not reflect real-time
				changes. Verify at the station before refueling.
			</p>
		</div>
	);
}

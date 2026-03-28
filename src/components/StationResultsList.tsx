import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { GasStation } from "@/types/station";
import { StationCard } from "@/components/StationCard";

interface StationResultsListProps {
	stations: GasStation[];
	loading: boolean;
	emptyMessage?: string;
}

export function StationResultsList({
	stations,
	loading,
	emptyMessage = "No stations found matching your criteria.",
}: StationResultsListProps) {
	return (
		<div className="flex flex-col gap-3">
			{loading ? (
				<div className="flex items-center justify-center py-24">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					<AnimatePresence mode="popLayout">
						{stations.map((station, index) => (
							<StationCard
								key={station.id}
								station={station}
								index={index}
							/>
						))}
					</AnimatePresence>
					{stations.length === 0 && (
						<p className="py-24 text-center text-sm text-muted-foreground">
							{emptyMessage}
						</p>
					)}
				</>
			)}
			<p className="text-sm dark:text-amber-500 text-red-600 text-center">
				⚠️ Fuel prices are crowd-sourced and may not reflect real-time
				changes. Verify at the station before refueling.
			</p>
		</div>
	);
}

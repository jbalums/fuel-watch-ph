import { motion } from "framer-motion";
import { FuelType, PublicStationSummary } from "@/types/station";
import {
	fuelTypes,
	fuelTypeTextColorClassNames,
} from "@/lib/fuel-prices";

interface HeroStatusProps {
	summary: PublicStationSummary | null;
}

function formatAveragePrice(
	summary: PublicStationSummary | null,
	fuelType: FuelType,
) {
	const price = summary?.averagePrices[fuelType] ?? null;

	if (price === null) {
		return "—";
	}

	return `₱${price.toFixed(2)}`;
}

export function HeroStatus({ summary }: HeroStatusProps) {
	return (
		<motion.div
			initial={{ opacity: 0, filter: "blur(10px)" }}
			animate={{ opacity: 1, filter: "blur(0px)" }}
			transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
			className="gradient-hero rounded-2xl p-6 md:p-10"
		>
			{/* <p className="text-label text-muted-foreground mb-2">Fuel Status</p>
			<h1 className="text-display text-foreground">
				Fuel is <span className={statusColor}>{statusText}</span>
			</h1> */}
			<p className="text-md font-bold text-muted-foreground mt-4 mb-1">
				Average Fuel Price:
			</p>
			<p className="text-xs mb-3 dark:text-amber-500 text-red-600">
				⚠️ Fuel prices are crowd-sourced and may not reflect real-time
				changes. Verify at the station before refueling.
			</p>
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				{fuelTypes.map((fuelType) => (
					<div key={fuelType}>
						<p
							className={`text-xs font-semibold uppercase tracking-[0.08em] ${fuelTypeTextColorClassNames[fuelType]}`}
						>
							{fuelType}
						</p>
						<p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
							{formatAveragePrice(summary, fuelType)}
						</p>
					</div>
				))}
			</div>
			<p className="mt-4 text-base text-muted-foreground">
				{summary?.totalStations ?? 0} Stations Listed
			</p>
		</motion.div>
	);
}

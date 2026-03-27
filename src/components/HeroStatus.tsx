import { motion } from "framer-motion";
import { FuelType, GasStation } from "@/types/station";

interface HeroStatusProps {
	stations: GasStation[];
}

const fuelTypes: FuelType[] = ["Unleaded", "Premium", "Diesel"];
const fuelTypesColors: string[] = [
	"text-green-600",
	"text-red-600",
	"text-amber-600",
];

function formatAveragePrice(stations: GasStation[], fuelType: FuelType) {
	const prices = stations
		.map((station) => station.prices[fuelType])
		.filter(
			(price): price is number =>
				typeof price === "number" &&
				Number.isFinite(price) &&
				price > 0,
		);

	if (prices.length === 0) {
		return "—";
	}

	const average =
		prices.reduce((sum, price) => sum + price, 0) / prices.length;

	return `₱${average.toFixed(2)}`;
}

export function HeroStatus({ stations }: HeroStatusProps) {
	const available = stations.filter((s) => s.status === "Available").length;
	const statusText = available > 0 ? "Available" : "Limited";
	const statusColor = available > 0 ? "text-success" : "text-warning";

	return (
		<motion.div
			initial={{ opacity: 0, filter: "blur(10px)" }}
			animate={{ opacity: 1, filter: "blur(0px)" }}
			transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
			className="gradient-hero rounded-2xl p-6 md:p-10"
		>
			<p className="text-label text-muted-foreground mb-2">Fuel Status</p>
			<h1 className="text-display text-foreground">
				Fuel is <span className={statusColor}>{statusText}</span>
			</h1>
			<p className="text-label text-muted-foreground mt-4 mb-2">
				Average Fuel Price:
			</p>
			<div className="flex flex-wrap items-end gap-4 md:gap-6">
				{fuelTypes.map((fuelType, index) => (
					<div key={fuelType}>
						<p
							className={`text-xs font-semibold uppercase tracking-[0.08em] ${fuelTypesColors[index]}`}
						>
							{fuelType}
						</p>
						<p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
							{formatAveragePrice(stations, fuelType)}
						</p>
					</div>
				))}
			</div>
			<p className="mt-4 text-base text-muted-foreground">
				{stations.length} Stations Nearby
			</p>
		</motion.div>
	);
}

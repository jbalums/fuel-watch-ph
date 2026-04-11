import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceTrendIndicatorProps {
	delta: number | null | undefined;
	className?: string;
}

export function PriceTrendIndicator({
	delta,
	className,
}: PriceTrendIndicatorProps) {
	if (typeof delta !== "number" || !Number.isFinite(delta)) {
		return null;
	}

	const normalizedDelta = Number(delta.toFixed(2));

	if (normalizedDelta === 0) {
		return null;
	}

	const isIncrease = normalizedDelta > 0;

	return (
		<span
			className={cn(
				"-mt-2 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
				isIncrease
					? "text-rose-600 dark:text-rose-400"
					: "text-emerald-600 dark:text-emerald-400",
				className,
			)}
		>
			{isIncrease ? (
				<ArrowUpRight className="h-3 w-3" />
			) : (
				<ArrowDownRight className="h-3 w-3" />
			)}
			{isIncrease ? "+" : "-"}₱ {Math.abs(normalizedDelta).toFixed(2)}
		</span>
	);
}

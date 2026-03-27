import { StationStatus } from "@/types/station";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
	status: StationStatus;
	className?: string;
}

const statusConfig: Record<
	StationStatus,
	{ bg: string; text: string; label: string }
> = {
	Available: {
		bg: "bg-success/15",
		text: "text-success",
		label: "Available",
	},
	Low: { bg: "bg-warning/15", text: "text-warning", label: "Low Stock" },
	Out: { bg: "bg-destructive/15", text: "text-destructive", label: "Out" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
	const config = statusConfig[status];
	return (
		<span
			className={cn(
				"inline-flex text-xs items-center gap-1.5 rounded-full px-3 py-1 text-ui",
				config.bg,
				config.text,
				className,
			)}
		>
			<span
				className={cn(
					"h-1.5 w-1.5 rounded-full",
					status === "Available"
						? "bg-success"
						: status === "Low"
							? "bg-warning"
							: "bg-destructive",
					status !== "Out" && "animate-pulse-status",
				)}
			/>
			{config.label}
		</span>
	);
}

import { StationStatus } from "@/types/station";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
	status: StationStatus;
	className?: string;
	compact?: boolean;
}

const statusConfig: Record<
	StationStatus,
	{ bg: string; text: string; label: string }
> = {
	Available: {
		bg: "bg-success/15",
		text: "text-success",
		label: "Avbl",
	},
	Low: { bg: "bg-warning/15", text: "text-warning", label: "Low" },
	Out: { bg: "bg-destructive/15", text: "text-destructive", label: "Out" },
};

export function StatusBadge({
	status,
	className,
	compact = false,
}: StatusBadgeProps) {
	const config = statusConfig[status];
	return (
		<span
			className={cn(
				"inline-flex text-xs items-center gap-0.5 rounded-full px-1 py-0.5 text-ui",
				config.bg,
				config.text,
				className,
			)}
		>
			<span
				className={cn(
					"h-1 w-1 rounded-full",
					status === "Available"
						? "bg-success"
						: status === "Low"
							? "bg-warning"
							: "bg-destructive",
					status !== "Out" && "animate-pulse-status",
				)}
			/>
			{compact
				? status === "Available"
					? "Avbl"
					: status
				: config.label}
		</span>
	);
}

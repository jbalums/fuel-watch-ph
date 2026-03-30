import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LguVerifiedBadgeProps {
	className?: string;
}

export function LguVerifiedBadge({ className }: LguVerifiedBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full bg-yellow-300/50 dark:bg-amber-950 px-2 py-1 text-xs font-medium text-red-600 dark:text-amber-300",
				className,
			)}
		>
			<BadgeCheck className="h-4 w-4" />
			LGU Verified
		</span>
	);
}

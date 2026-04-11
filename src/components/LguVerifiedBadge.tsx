import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LguVerifiedBadgeProps {
	className?: string;
}

export function LguVerifiedBadge({ className }: LguVerifiedBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full shadow-sm shadow-amber-400 bg-yellow-300/80 dark:bg-amber-950 px-2 py-1 text-[10px] font-medium text-red-600 dark:text-amber-300",
				className,
			)}
		>
			<BadgeCheck className="h-3 w-3" />
			LGU Verified
		</span>
	);
}

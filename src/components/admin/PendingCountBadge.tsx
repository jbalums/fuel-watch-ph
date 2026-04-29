import { Badge } from "@/components/ui/badge";

type PendingCountBadgeProps = {
	count: number;
	className?: string;
};

export function PendingCountBadge({
	count,
	className,
}: PendingCountBadgeProps) {
	if (count <= 0) {
		return null;
	}

	return (
		<Badge
			variant="destructive"
			className={className}
		>
			{count}
		</Badge>
	);
}

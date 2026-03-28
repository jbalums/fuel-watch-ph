import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedStationBadgeProps {
  className?: string;
}

export function VerifiedStationBadge({
  className,
}: VerifiedStationBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent",
        className,
      )}
    >
      <BadgeCheck className="h-3.5 w-3.5" />
      Verified Station
    </span>
  );
}

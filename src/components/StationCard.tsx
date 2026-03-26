import { GasStation } from "@/types/station";
import { StatusBadge } from "./StatusBadge";
import { motion } from "framer-motion";
import { MapPin, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface StationCardProps {
  station: GasStation;
  index: number;
}

export function StationCard({ station, index }: StationCardProps) {
  const statusBarColor =
    station.status === "Available"
      ? "status-bar-available"
      : station.status === "Low"
      ? "status-bar-low"
      : "status-bar-out";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      whileTap={{ scale: 0.97 }}
      className="group relative flex overflow-hidden rounded-xl bg-card shadow-sovereign cursor-pointer sovereign-ease"
    >
      {/* Status bar */}
      <div className={cn("w-1 shrink-0 rounded-l-xl", statusBarColor)} />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground">{station.name}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-sm">{station.address}</span>
            </div>
          </div>
          <StatusBadge status={station.status} />
        </div>

        <div className="flex items-end justify-between">
          <div>
            <span className="text-label text-muted-foreground">{station.fuelType}</span>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
              {station.status === "Out" ? "—" : `₱${station.pricePerLiter.toFixed(2)}`}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {station.lastUpdated}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {station.reportCount}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

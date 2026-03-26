import { motion } from "framer-motion";
import { GasStation } from "@/types/station";

interface HeroStatusProps {
  stations: GasStation[];
}

export function HeroStatus({ stations }: HeroStatusProps) {
  const available = stations.filter((s) => s.status === "Available").length;
  const avgPrice =
    stations
      .filter((s) => s.pricePerLiter > 0)
      .reduce((sum, s) => sum + s.pricePerLiter, 0) /
    (stations.filter((s) => s.pricePerLiter > 0).length || 1);

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
      <p className="mt-3 text-base text-muted-foreground">
        Average Price:{" "}
        <span className="font-semibold text-foreground tabular-nums">
          ₱{avgPrice.toFixed(2)}
        </span>{" "}
        • {stations.length} Stations Nearby
      </p>
    </motion.div>
  );
}

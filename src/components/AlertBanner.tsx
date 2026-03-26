import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, TrendingUp, X } from "lucide-react";
import { useState } from "react";

interface Alert {
  id: string;
  type: "price" | "shortage";
  message: string;
  timestamp: string;
}

interface AlertBannerProps {
  alerts: Alert[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {visible.map((alert) => (
          <motion.div
            key={alert.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.4 }}
            className={`flex items-center gap-3 rounded-xl p-4 ${
              alert.type === "price"
                ? "bg-warning/10 text-warning"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {alert.type === "price" ? (
              <TrendingUp className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{alert.message}</p>
              <p className="text-xs opacity-60 mt-0.5">{alert.timestamp}</p>
            </div>
            <button
              onClick={() => setDismissed((s) => new Set(s).add(alert.id))}
              className="shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100 sovereign-ease"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

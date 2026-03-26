import { useState } from "react";
import { FuelType, StationStatus } from "@/types/station";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { MapPin, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const fuelTypes: FuelType[] = ["Unleaded", "Premium", "Diesel"];
const statuses: StationStatus[] = ["Available", "Low", "Out"];

export function ReportForm() {
  const { user } = useAuth();
  const [stationName, setStationName] = useState("");
  const [price, setPrice] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("Diesel");
  const [status, setStatus] = useState<StationStatus>("Available");
  const [submitted, setSubmitted] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDetecting(false);
        toast.success("Location detected!");
      },
      () => {
        setDetecting(false);
        toast.error("Could not detect location");
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationName || !price || !user) return;

    setSubmitting(true);
    const { error } = await supabase.from("fuel_reports").insert({
      user_id: user.id,
      station_name: stationName,
      price: parseFloat(price),
      fuel_type: fuelType,
      status,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });

    if (error) {
      toast.error("Failed to submit report");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
    setTimeout(() => {
      setSubmitted(false);
      setStationName("");
      setPrice("");
      setCoords(null);
    }, 2500);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-card p-10 text-center shadow-sovereign"
      >
        <CheckCircle className="h-12 w-12 text-success" />
        <h2 className="text-headline text-foreground">Report Submitted</h2>
        <p className="text-sm text-muted-foreground">
          Thank you for helping fellow motorists!
        </p>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: [0.2, 0.8, 0.2, 1] }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-sovereign"
    >
      <h2 className="text-headline text-foreground">Report Fuel Price</h2>

      {/* Station name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Station Name</label>
        <input
          type="text"
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          placeholder="e.g. Petron EDSA Cubao"
          className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
        />
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Location</label>
        <button
          type="button"
          onClick={handleDetectLocation}
          className="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3 text-sm text-muted-foreground hover:text-foreground sovereign-ease transition-colors"
        >
          <MapPin className={cn("h-4 w-4", detecting && "animate-pulse text-accent", coords && "text-success")} />
          {detecting ? "Detecting..." : coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Auto-detect GPS location"}
        </button>
      </div>

      {/* Price */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Price per Liter (₱)</label>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all tabular-nums"
        />
      </div>

      {/* Fuel type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Fuel Type</label>
        <div className="flex gap-2">
          {fuelTypes.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFuelType(f)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-ui sovereign-ease transition-colors",
                fuelType === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-alt text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label text-muted-foreground">Availability</label>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-ui sovereign-ease transition-colors",
                status === s
                  ? s === "Available"
                    ? "bg-success/20 text-success"
                    : s === "Low"
                    ? "bg-warning/20 text-warning"
                    : "bg-destructive/20 text-destructive"
                  : "bg-surface-alt text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={submitting}
        className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground sovereign-ease hover:bg-primary-hover transition-colors disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {submitting ? "Submitting..." : "Submit Report"}
      </motion.button>
    </motion.form>
  );
}

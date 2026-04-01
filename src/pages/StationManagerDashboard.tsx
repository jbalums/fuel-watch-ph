import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MapPin, Save, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/app-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useManagedStation } from "@/hooks/useManagedStation";
import { supabase } from "@/integrations/supabase/client";
import {
  createEmptyFuelPriceFormMap,
  createEmptyFuelPriceMap,
  fuelTypes,
} from "@/lib/fuel-prices";
import type { FuelType, StationStatus } from "@/types/station";

type StationPricesFormState = Record<FuelType, string>;

function normalizePrices(
  prices: Record<FuelType, number | null>,
): StationPricesFormState {
  return fuelTypes.reduce((formattedPrices, fuelType) => {
    const price = prices[fuelType];
    formattedPrices[fuelType] =
      typeof price === "number" && price > 0 ? price.toFixed(2) : "";
    return formattedPrices;
  }, createEmptyFuelPriceFormMap());
}

export default function StationManagerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: station, isLoading } = useManagedStation();
  const [address, setAddress] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("Diesel");
  const [status, setStatus] = useState<StationStatus>("Available");
  const [prices, setPrices] = useState<StationPricesFormState>(
    createEmptyFuelPriceFormMap(),
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate("/auth");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!station) {
      return;
    }

    setAddress(station.address);
    setFuelType(station.fuelType);
    setStatus(station.status);
    setPrices(normalizePrices(station.prices));
  }, [station]);

  const saveStation = useMutation({
    mutationFn: async () => {
      if (!station) {
        throw new Error("No managed station found");
      }

      const payload = fuelTypes.reduce((fuelPrices, currentFuelType) => {
        fuelPrices[currentFuelType] = prices[currentFuelType].trim()
          ? Number(prices[currentFuelType])
          : null;
        return fuelPrices;
      }, createEmptyFuelPriceMap());

      const selectedPrice = payload[fuelType];

      if (!address.trim()) {
        throw new Error("Station address is required");
      }

      if (selectedPrice === null || Number.isNaN(selectedPrice) || selectedPrice <= 0) {
        throw new Error(
          `Add a valid ${fuelType} price to match the selected fuel type`,
        );
      }

      const { error } = await supabase.rpc("update_managed_station", {
        _station_id: station.id,
        _address: address.trim(),
        _status: status,
        _fuel_type: fuelType,
        _prices: payload,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed_station"] }),
        queryClient.invalidateQueries({ queryKey: ["gas_stations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "gas_stations"] }),
        queryClient.invalidateQueries({
          queryKey: ["public_station_browse"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["public_station_summary"],
        }),
      ]);
      toast.success("Station details updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-10">
      <header className="sticky top-0 z-40 surface-glass py-4">
        <div className="container flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              Station Manager
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage your verified station
            </p>
          </div>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.2, 0.8, 0.2, 1] }}
        className="container mt-6"
      >
        {!station ? (
          <div className="mx-auto max-w-2xl rounded-2xl bg-card p-6 shadow-sovereign">
            <h2 className="text-lg font-semibold text-foreground">
              No verified station assigned
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Once your station claim is approved by an admin, you will be able
              to manage your station here.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            <div className="rounded-2xl bg-card p-6 shadow-sovereign">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-headline text-foreground">{station.name}</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              </div>
              <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{station.address}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Coordinates: {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveStation.mutate();
              }}
              className="rounded-2xl bg-card p-6 shadow-sovereign"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={station.name}
                  readOnly
                  className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                />
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Station address"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <select
                  value={fuelType}
                  onChange={(event) =>
                    setFuelType(event.target.value as FuelType)
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {fuelTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as StationStatus)
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="Available">Available</option>
                  <option value="Low">Low</option>
                  <option value="Out">Out</option>
                </select>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Fuel Prices
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Update the latest prices for your station.
                    </p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
                    Primary: <b>{fuelType}</b>
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {fuelTypes.map((type) => (
                    <div key={type} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {type}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={prices[type]}
                        onChange={(event) =>
                          setPrices((current) => ({
                            ...current,
                            [type]: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-foreground"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saveStation.isPending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {saveStation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Station Updates
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}

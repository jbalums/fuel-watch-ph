import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GasStation, StationStatus, FuelType } from "@/types/station";
import { formatDistanceToNow } from "date-fns";

const fuelTypes: FuelType[] = ["Unleaded", "Premium", "Diesel"];

function normalizeStationPrices(
  rawPrices: unknown,
  fallbackFuelType: FuelType,
  fallbackPricePerLiter: number,
) {
  const prices: Record<FuelType, number | null> = {
    Unleaded: null,
    Premium: null,
    Diesel: null,
  };

  if (rawPrices && typeof rawPrices === "object" && !Array.isArray(rawPrices)) {
    for (const fuelType of fuelTypes) {
      const value = rawPrices[fuelType as keyof typeof rawPrices];
      prices[fuelType] =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : null;
      if (prices[fuelType] !== null && Number.isNaN(prices[fuelType])) {
        prices[fuelType] = null;
      }
    }
  }

  if (Number.isFinite(fallbackPricePerLiter) && fallbackPricePerLiter > 0 && prices[fallbackFuelType] === null) {
    prices[fallbackFuelType] = fallbackPricePerLiter;
  }

  return prices;
}

async function fetchStations(): Promise<GasStation[]> {
  const { data, error } = await supabase
    .from("gas_stations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((s) => {
    const fuelType = s.fuel_type as FuelType;
    const fallbackPricePerLiter = Number(s.price_per_liter) || 0;
    const prices = normalizeStationPrices(s.prices, fuelType, fallbackPricePerLiter);

    return {
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      prices,
      isVerified: s.is_verified,
      verifiedAt: s.verified_at,
      managerUserId: s.manager_user_id,
      status: s.status as StationStatus,
      fuelType,
      pricePerLiter: prices[fuelType] ?? fallbackPricePerLiter,
      updatedAt: s.updated_at,
      lastUpdated: formatDistanceToNow(new Date(s.updated_at), { addSuffix: true }),
      reportCount: s.report_count,
    };
  });
}

export function useStations() {
  return useQuery({
    queryKey: ["gas_stations"],
    queryFn: fetchStations,
    staleTime: 30_000,
  });
}

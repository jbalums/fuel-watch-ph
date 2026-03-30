import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { GasStation, FuelType, StationStatus } from "@/types/station";

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

  if (
    Number.isFinite(fallbackPricePerLiter) &&
    fallbackPricePerLiter > 0 &&
    prices[fallbackFuelType] === null
  ) {
    prices[fallbackFuelType] = fallbackPricePerLiter;
  }

  return prices;
}

function mapManagedStation(station: Awaited<ReturnType<typeof fetchManagedStation>>) {
  return station;
}

async function fetchManagedStation(userId: string): Promise<GasStation | null> {
  const { data, error } = await supabase
    .from("gas_stations")
    .select("*")
    .eq("manager_user_id", userId)
    .eq("is_verified", true)
    .order("verified_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const station = data?.[0];

  if (!station) {
    return null;
  }

  const fuelType = station.fuel_type as FuelType;
  const fallbackPricePerLiter = Number(station.price_per_liter) || 0;
  const prices = normalizeStationPrices(
    station.prices,
    fuelType,
    fallbackPricePerLiter,
  );

  return {
    id: station.id,
    name: station.name,
    address: station.address,
    lat: station.lat,
    lng: station.lng,
    provinceCode: station.province_code,
    cityMunicipalityCode: station.city_municipality_code,
    prices,
    isVerified: station.is_verified,
    isLguVerified: station.is_lgu_verified,
    lguVerifiedAt: station.lgu_verified_at,
    lguVerifiedBy: station.lgu_verified_by,
    lguVerifiedRole:
      station.lgu_verified_role as
        | "province_admin"
        | "city_admin"
        | "lgu_staff"
        | null,
    verifiedAt: station.verified_at,
    managerUserId: station.manager_user_id,
    status: station.status as StationStatus,
    fuelType,
    pricePerLiter: prices[fuelType] ?? fallbackPricePerLiter,
    updatedAt: station.updated_at,
    lastUpdated: formatDistanceToNow(new Date(station.updated_at), {
      addSuffix: true,
    }),
    reportCount: station.report_count,
  };
}

export function useManagedStation() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["managed_station", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const station = await fetchManagedStation(user!.id);
      return mapManagedStation(station);
    },
  });
}

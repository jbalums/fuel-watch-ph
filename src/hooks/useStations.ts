import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GasStation, StationStatus, FuelType } from "@/types/station";
import { formatDistanceToNow } from "date-fns";

async function fetchStations(): Promise<GasStation[]> {
  const { data, error } = await supabase
    .from("gas_stations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    prices: { Unleaded: null, Premium: null, Diesel: null, [s.fuel_type]: s.price_per_liter || null } as Record<FuelType, number | null>,
    status: s.status as StationStatus,
    fuelType: s.fuel_type as FuelType,
    pricePerLiter: Number(s.price_per_liter) || 0,
    lastUpdated: formatDistanceToNow(new Date(s.updated_at), { addSuffix: true }),
    reportCount: s.report_count,
  }));
}

export function useStations() {
  return useQuery({
    queryKey: ["gas_stations"],
    queryFn: fetchStations,
    staleTime: 30_000,
  });
}

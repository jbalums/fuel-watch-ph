import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GasStation } from "@/types/station";
import type { Tables } from "@/integrations/supabase/types";
import { mapGasStationRow } from "@/lib/station-mappers";

// Explicit projection of only the columns mapGasStationRow consumes. Avoids
// shipping heavy/unused columns over mobile networks on the homepage.
const STATION_COLUMNS =
  "id,name,address,lat,lng,google_place_id,station_brand_logo_id," +
  "province_code,city_municipality_code,prices,fuel_type,price_per_liter," +
  "fuel_availability,status,previous_prices,price_trends,is_verified," +
  "is_lgu_verified,lgu_verified_at,lgu_verified_by,lgu_verified_role," +
  "verified_at,manager_user_id,updated_at,report_count";

async function fetchStations(): Promise<GasStation[]> {
  const { data, error } = await supabase
    .from("gas_stations")
    .select(STATION_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  // Projected select yields a narrowed row type; the projection covers every
  // column mapGasStationRow reads, so cast back to the full row shape.
  return ((data ?? []) as unknown as Tables<"gas_stations">[]).map(
    mapGasStationRow,
  );
}

export function useStations() {
  return useQuery({
    queryKey: ["gas_stations"],
    queryFn: fetchStations,
    staleTime: 30_000,
  });
}

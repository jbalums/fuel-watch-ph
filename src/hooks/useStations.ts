import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GasStation } from "@/types/station";
import { mapGasStationRow } from "@/lib/station-mappers";

async function fetchStations(): Promise<GasStation[]> {
  const { data, error } = await supabase
    .from("gas_stations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapGasStationRow);
}

export function useStations() {
  return useQuery({
    queryKey: ["gas_stations"],
    queryFn: fetchStations,
    staleTime: 30_000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { GasStation } from "@/types/station";
import { mapGasStationRow } from "@/lib/station-mappers";

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

  return mapGasStationRow(station);
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

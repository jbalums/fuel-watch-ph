import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useReleaseManagedStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stationId: string) => {
      const { data, error } = await supabase.rpc("release_managed_station", {
        _station_id: stationId,
      });

      if (error) {
        throw error;
      }

      return data;
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
        queryClient.invalidateQueries({
          queryKey: ["station_claim_requests", "mine"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "station_claim_requests"],
        }),
      ]);
    },
  });
}

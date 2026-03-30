import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPublicStationSummaryRow } from "@/lib/station-mappers";
import type { PublicStationSummary } from "@/types/station";

async function fetchPublicStationSummary(): Promise<PublicStationSummary> {
	const { data, error } = await supabase.rpc("get_public_station_summary");

	if (error) {
		throw error;
	}

	return mapPublicStationSummaryRow(
		data?.[0] ?? {
			total_stations: 0,
			average_unleaded: null,
			average_premium: null,
			average_diesel: null,
		},
	);
}

export function usePublicStationSummary() {
	return useQuery({
		queryKey: ["public_station_summary"],
		queryFn: fetchPublicStationSummary,
		staleTime: 60_000,
	});
}

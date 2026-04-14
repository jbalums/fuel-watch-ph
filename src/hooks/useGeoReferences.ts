import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GeoProvince = Tables<"geo_provinces">;
export type GeoCityMunicipality = Tables<"geo_cities_municipalities">;

export function useGeoReferences(options?: {
	provinceCode?: string;
	includeAllCities?: boolean;
}) {
	const provinceCode = options?.provinceCode?.trim() ?? "";
	const includeAllCities = options?.includeAllCities ?? false;

	const provincesQuery = useQuery({
		queryKey: ["geo", "provinces"],
		queryFn: async (): Promise<GeoProvince[]> => {
			const { data, error } = await supabase
				.from("geo_provinces")
				.select("*")
				.order("name", { ascending: true });

			if (error) {
				throw error;
			}

			return data ?? [];
		},
		staleTime: 5 * 60_000,
	});

	const citiesQuery = useQuery({
		queryKey: [
			"geo",
			"cities_municipalities",
			includeAllCities ? "all" : provinceCode || "none",
		],
		enabled: includeAllCities || Boolean(provinceCode),
		queryFn: async (): Promise<GeoCityMunicipality[]> => {
			let query = supabase
				.from("geo_cities_municipalities")
				.select("*")
				.order("name", { ascending: true });

			if (!includeAllCities && provinceCode) {
				query = query.eq("province_code", provinceCode);
			}

			const { data, error } = await query;

			if (error) {
				throw error;
			}

			return data ?? [];
		},
		staleTime: 5 * 60_000,
	});

	const citiesByProvince = useMemo(() => {
		const grouped = new Map<string, GeoCityMunicipality[]>();

		for (const city of citiesQuery.data ?? []) {
			const current = grouped.get(city.province_code) ?? [];
			current.push(city);
			grouped.set(city.province_code, current);
		}

		return grouped;
	}, [citiesQuery.data]);

	return {
		provinces: provincesQuery.data ?? [],
		cities: citiesQuery.data ?? [],
		citiesByProvince,
		isLoading: provincesQuery.isLoading || citiesQuery.isLoading,
		error:
			provincesQuery.error instanceof Error
				? provincesQuery.error
				: citiesQuery.error instanceof Error
					? citiesQuery.error
					: null,
	};
}

import { useQuery } from "@tanstack/react-query";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { mapGasStationRow } from "@/lib/station-mappers";
import type { FilterFuelType, SortOption, StatusFilter } from "@/types/station";

type BrowseStationRow =
	Database["public"]["Functions"]["list_public_gas_stations"]["Returns"][number];

interface UsePublicStationResultsOptions {
	searchQuery?: string;
	fuelFilter?: FilterFuelType;
	statusFilter?: StatusFilter;
	sortBy?: SortOption;
	page: number;
	pageSize: number;
	provinceCode?: string;
	cityMunicipalityCode?: string;
	searchDebounceMs?: number;
}

function mapBrowseStationRow(row: BrowseStationRow) {
	if (
		!row.id ||
		!row.name ||
		!row.address ||
		row.lat === null ||
		row.lng === null ||
		!row.fuel_type ||
		row.price_per_liter === null ||
		!row.updated_at ||
		row.report_count === null ||
		!row.created_at ||
		!row.status
	) {
		return null;
	}

	return mapGasStationRow({
		id: row.id,
		name: row.name,
		address: row.address,
		lat: row.lat,
		lng: row.lng,
		province_code: row.province_code,
		city_municipality_code: row.city_municipality_code,
		google_place_id: row.google_place_id,
		station_brand_logo_id: null,
		prices: row.prices ?? {},
		fuel_availability: row.fuel_availability ?? {},
		previous_prices: row.previous_prices ?? {},
		price_trends: row.price_trends ?? {},
		is_verified: row.is_verified ?? false,
		is_lgu_verified: row.is_lgu_verified ?? false,
		lgu_verified_at: row.lgu_verified_at,
		lgu_verified_by: row.lgu_verified_by,
		lgu_verified_role: row.lgu_verified_role,
		verified_at: row.verified_at,
		manager_user_id: row.manager_user_id,
		status: row.status,
		fuel_type: row.fuel_type,
		price_per_liter: row.price_per_liter,
		updated_at: row.updated_at,
		report_count: row.report_count,
		created_at: row.created_at,
	});
}

async function fetchPublicStationResults({
	searchQuery,
	fuelFilter,
	statusFilter,
	sortBy,
	provinceCode,
	cityMunicipalityCode,
	page,
	pageSize,
	userLat,
	userLng,
}: {
	searchQuery: string;
	fuelFilter: FilterFuelType;
	statusFilter: StatusFilter;
	sortBy: SortOption;
	provinceCode?: string;
	cityMunicipalityCode?: string;
	page: number;
	pageSize: number;
	userLat?: number;
	userLng?: number;
}) {
	const { data, error } = await supabase.rpc("list_public_gas_stations", {
		_search: searchQuery.trim() || null,
		_fuel_filter: fuelFilter,
		_status_filter: statusFilter,
		_sort_by: sortBy,
		_province_code: provinceCode?.trim() || null,
		_city_municipality_code: cityMunicipalityCode?.trim() || null,
		_page: page,
		_page_size: pageSize,
		_user_lat: userLat ?? null,
		_user_lng: userLng ?? null,
	});

	if (error) {
		throw error;
	}

	const rows = (data ?? []) as BrowseStationRow[];

	return {
		stations: rows
			.map(mapBrowseStationRow)
			.filter(
				(station): station is NonNullable<typeof station> => station !== null,
			),
		totalCount: Number(rows[0]?.total_count ?? 0),
	};
}

export function usePublicStationResults({
	searchQuery = "",
	fuelFilter = "All",
	statusFilter = "All",
	sortBy = "price_asc",
	page,
	pageSize,
	provinceCode,
	cityMunicipalityCode,
	searchDebounceMs = 300,
}: UsePublicStationResultsOptions) {
	const { coordinates: currentLocation } = useCurrentLocation();
	const debouncedSearchQuery = useDebouncedValue(searchQuery, searchDebounceMs);

	const stationsQuery = useQuery({
		queryKey: [
			"public_station_browse",
			debouncedSearchQuery,
			fuelFilter,
			statusFilter,
			sortBy,
			provinceCode ?? "",
			cityMunicipalityCode ?? "",
			page,
			pageSize,
			fuelFilter === "All" ? currentLocation?.lat ?? null : null,
			fuelFilter === "All" ? currentLocation?.lng ?? null : null,
		],
		queryFn: () =>
			fetchPublicStationResults({
				searchQuery: debouncedSearchQuery,
				fuelFilter,
				statusFilter,
				sortBy,
				provinceCode,
				cityMunicipalityCode,
				page,
				pageSize,
				userLat: fuelFilter === "All" ? currentLocation?.lat : undefined,
				userLng: fuelFilter === "All" ? currentLocation?.lng : undefined,
			}),
		staleTime: 30_000,
	});

	return {
		stations: stationsQuery.data?.stations ?? [],
		totalCount: stationsQuery.data?.totalCount ?? 0,
		isLoading: stationsQuery.isLoading,
	};
}

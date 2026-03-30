import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { mapGasStationRow } from "@/lib/station-mappers";
import type { FilterFuelType, SortOption, StatusFilter } from "@/types/station";

const fuelFilters: FilterFuelType[] = ["All", "Unleaded", "Premium", "Diesel"];
const statusFilters: StatusFilter[] = ["All", "Available", "Low", "Out"];
const sortOptions: SortOption[] = ["price_asc", "price_desc"];

type BrowseStationRow =
	Database["public"]["Functions"]["list_public_gas_stations"]["Returns"][number];

interface UseStationBrowseOptions {
	page: number;
	pageSize: number;
	provinceCode?: string;
	cityMunicipalityCode?: string;
}

function isFuelFilter(value: string | null): value is FilterFuelType {
	return value !== null && fuelFilters.includes(value as FilterFuelType);
}

function isStatusFilter(value: string | null): value is StatusFilter {
	return value !== null && statusFilters.includes(value as StatusFilter);
}

function isSortOption(value: string | null): value is SortOption {
	return value !== null && sortOptions.includes(value as SortOption);
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
		prices: row.prices ?? {},
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

async function fetchBrowseStations({
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
			.filter((station): station is NonNullable<typeof station> => station !== null),
		totalCount: Number(rows[0]?.total_count ?? 0),
	};
}

export function useStationBrowse({
	page,
	pageSize,
	provinceCode,
	cityMunicipalityCode,
}: UseStationBrowseOptions) {
	const { coordinates: currentLocation } = useCurrentLocation();
	const [searchParams, setSearchParams] = useSearchParams();

	const searchQuery = searchParams.get("q") ?? "";
	const fuelFilter = isFuelFilter(searchParams.get("fuel"))
		? searchParams.get("fuel")!
		: "All";
	const statusFilter = isStatusFilter(searchParams.get("status"))
		? searchParams.get("status")!
		: "All";
	const sortBy = isSortOption(searchParams.get("sort"))
		? searchParams.get("sort")!
		: "price_asc";
	const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

	const updateSearchParams = (updates: Record<string, string | null>) => {
		const nextParams = new URLSearchParams(searchParams);

		for (const [key, value] of Object.entries(updates)) {
			if (!value) {
				nextParams.delete(key);
			} else {
				nextParams.set(key, value);
			}
		}

		setSearchParams(nextParams, { replace: true });
	};

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
			fetchBrowseStations({
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
		stationsLoading: stationsQuery.isLoading,
		searchQuery,
		fuelFilter,
		statusFilter,
		sortBy,
		setSearchQuery: (value: string) =>
			updateSearchParams({
				q: value.trim() ? value : null,
			}),
		setFuelFilter: (value: FilterFuelType) =>
			updateSearchParams({
				fuel: value === "All" ? null : value,
			}),
		setStatusFilter: (value: StatusFilter) =>
			updateSearchParams({
				status: value === "All" ? null : value,
			}),
		setSortBy: (value: SortOption) =>
			updateSearchParams({
				sort: value === "price_asc" ? null : value,
			}),
	};
}

import { useSearchParams } from "react-router-dom";
import { fuelTypes as availableFuelTypes } from "@/lib/fuel-prices";
import { usePublicStationResults } from "@/hooks/usePublicStationResults";
import type { FilterFuelType, SortOption, StatusFilter } from "@/types/station";

const fuelFilters: FilterFuelType[] = ["All", ...availableFuelTypes];
const statusFilters: StatusFilter[] = ["All", "Available", "Low", "Out"];
const sortOptions: SortOption[] = ["price_asc", "price_desc"];

interface UseStationBrowseOptions {
	page: number;
	pageSize: number;
	provinceCode?: string;
	cityMunicipalityCode?: string;
	excludeUnpriced?: boolean;
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

export function useStationBrowse({
	page,
	pageSize,
	provinceCode,
	cityMunicipalityCode,
	excludeUnpriced = false,
}: UseStationBrowseOptions) {
	const [searchParams, setSearchParams] = useSearchParams();

	const searchQuery = searchParams.get("q") ?? "";
	const fuelFilter = isFuelFilter(searchParams.get("fuel"))
		? searchParams.get("fuel")!
		: "All";
	const statusFilter =
		fuelFilter === "All"
			? "All"
			: isStatusFilter(searchParams.get("status"))
				? searchParams.get("status")!
				: "All";
	const sortBy = isSortOption(searchParams.get("sort"))
		? searchParams.get("sort")!
		: "price_asc";

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

	const { stations, totalCount, isLoading } = usePublicStationResults({
		searchQuery,
		fuelFilter,
		statusFilter,
		sortBy,
		page,
		pageSize,
		provinceCode,
		cityMunicipalityCode,
		excludeUnpriced,
	});

	return {
		stations,
		totalCount,
		stationsLoading: isLoading,
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
				status: value === "All" ? null : searchParams.get("status"),
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

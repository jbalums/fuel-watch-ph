import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useStations } from "@/hooks/useStations";
import type {
	FilterFuelType,
	FuelType,
	GasStation,
	SortOption,
	StatusFilter,
} from "@/types/station";

const fuelFilters: FilterFuelType[] = ["All", "Unleaded", "Premium", "Diesel"];
const statusFilters: StatusFilter[] = ["All", "Available", "Low", "Out"];
const sortOptions: SortOption[] = ["price_asc", "price_desc"];

function hasValidFuelPrice(station: GasStation, fuelType: FuelType) {
	const price = station.prices[fuelType];
	return typeof price === "number" && Number.isFinite(price) && price > 0;
}

function getFuelSortPrice(station: GasStation, fuelFilter: FilterFuelType) {
	return station.prices[fuelFilter] ?? Number.POSITIVE_INFINITY;
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

export function useStationBrowse() {
	const { data: stations = [], isLoading: stationsLoading } = useStations();
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

	const filteredStations = useMemo(() => {
		let list = [...stations];

		if (searchQuery) {
			const normalizedQuery = searchQuery.toLowerCase();
			list = list.filter(
				(station) =>
					station.name.toLowerCase().includes(normalizedQuery) ||
					station.address.toLowerCase().includes(normalizedQuery),
			);
		}

		if (statusFilter !== "All") {
			list = list.filter((station) => station.status === statusFilter);
		}

		if (fuelFilter !== "All") {
			list = list.filter((station) =>
				hasValidFuelPrice(station, fuelFilter),
			);
		}

		if (fuelFilter === "All") {
			list.sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() -
					new Date(a.updatedAt).getTime(),
			);
			return list;
		}

		list.sort((a, b) => {
			if (a.status === "Out") return 1;
			if (b.status === "Out") return -1;

			const priceDelta =
				getFuelSortPrice(a, fuelFilter) -
				getFuelSortPrice(b, fuelFilter);

			return sortBy === "price_desc" ? priceDelta * -1 : priceDelta;
		});

		return list;
	}, [fuelFilter, searchQuery, sortBy, stations, statusFilter]);

	return {
		stations,
		stationsLoading,
		filteredStations,
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

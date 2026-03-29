import { useEffect, useMemo, useState } from "react";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { useStationBrowse } from "@/hooks/useStationBrowse";

const STATIONS_PER_PAGE = 20;

export default function SearchPage() {
	const {
		stationsLoading,
		filteredStations,
		searchQuery,
		fuelFilter,
		statusFilter,
		sortBy,
		setSearchQuery,
		setFuelFilter,
		setStatusFilter,
		setSortBy,
	} = useStationBrowse();
	const [currentPage, setCurrentPage] = useState(1);
	const totalPages = Math.max(
		1,
		Math.ceil(filteredStations.length / STATIONS_PER_PAGE),
	);
	const activePage = Math.min(currentPage, totalPages);
	const paginatedStations = useMemo(() => {
		const startIndex = (activePage - 1) * STATIONS_PER_PAGE;
		return filteredStations.slice(
			startIndex,
			startIndex + STATIONS_PER_PAGE,
		);
	}, [activePage, filteredStations]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchQuery, fuelFilter, statusFilter, sortBy]);

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	return (
		<div className="min-h-[calc(100dvh-185px)]">
			<SearchFilter
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				fuelFilter={fuelFilter}
				onFuelFilterChange={setFuelFilter}
				statusFilter={statusFilter}
				onStatusFilterChange={setStatusFilter}
				sortBy={sortBy}
				onSortChange={setSortBy}
			/>
			<div className="mt-5">
				<StationResultsList
					stations={paginatedStations}
					loading={stationsLoading}
					currentPage={activePage}
					totalPages={totalPages}
					onPageChange={setCurrentPage}
				/>
			</div>
		</div>
	);
}

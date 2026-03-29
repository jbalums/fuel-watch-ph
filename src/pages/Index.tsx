import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { HeroStatus } from "@/components/HeroStatus";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { mockAlerts } from "@/data/mockStations";
import { useStationBrowse } from "@/hooks/useStationBrowse";

const STATIONS_PER_PAGE = 10;

export default function Index() {
	const {
		stations,
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
		<>
			<HeroStatus stations={stations} />
			<AlertBanner alerts={mockAlerts} />
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
			<StationResultsList
				stations={paginatedStations}
				loading={stationsLoading}
				currentPage={activePage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
			/>
		</>
	);
}

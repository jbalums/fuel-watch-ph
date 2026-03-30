import { useEffect, useState } from "react";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { useStationBrowse } from "@/hooks/useStationBrowse";

const STATIONS_PER_PAGE = 20;

export default function SearchPage() {
	const [currentPage, setCurrentPage] = useState(1);
	const {
		stations,
		totalCount,
		stationsLoading,
		searchQuery,
		fuelFilter,
		statusFilter,
		sortBy,
		setSearchQuery,
		setFuelFilter,
		setStatusFilter,
		setSortBy,
	} = useStationBrowse({
		page: currentPage,
		pageSize: STATIONS_PER_PAGE,
	});
	const totalPages = Math.max(1, Math.ceil(totalCount / STATIONS_PER_PAGE));

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
					stations={stations}
					loading={stationsLoading}
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={setCurrentPage}
				/>
			</div>
		</div>
	);
}

import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { useStationBrowse } from "@/hooks/useStationBrowse";

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
					stations={filteredStations}
					loading={stationsLoading}
				/>
			</div>
		</div>
	);
}

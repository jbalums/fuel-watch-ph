import { useEffect, useRef, useState } from "react";
import { HeroStatus } from "@/components/HeroStatus";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { usePublicStationSummary } from "@/hooks/usePublicStationSummary";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useStationBrowse } from "@/hooks/useStationBrowse";
import { useUserAccess } from "@/hooks/useUserAccess";

const STATIONS_PER_PAGE = 10;

export default function Index() {
	const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
	const [selectedCityMunicipalityCode, setSelectedCityMunicipalityCode] =
		useState("");
	const { isLguOperator } = useUserAccess();
	const { data: currentUserScope } = useCurrentUserScope(isLguOperator);
	const { provinces, citiesByProvince } = useGeoReferences({
		provinceCode: selectedProvinceCode,
	});
	const { data: stationSummary } = usePublicStationSummary();
	const [currentPage, setCurrentPage] = useState(1);
	const hasInitializedScopeFilters = useRef(false);
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
		provinceCode: selectedProvinceCode,
		cityMunicipalityCode: selectedCityMunicipalityCode,
		excludeUnpriced: true,
	});
	const availableCities = selectedProvinceCode
		? (citiesByProvince.get(selectedProvinceCode) ?? [])
		: [];
	const totalPages = Math.max(1, Math.ceil(totalCount / STATIONS_PER_PAGE));

	useEffect(() => {
		if (
			!isLguOperator ||
			!currentUserScope ||
			hasInitializedScopeFilters.current
		) {
			return;
		}

		setSelectedProvinceCode(currentUserScope.provinceCode);
		setSelectedCityMunicipalityCode(
			currentUserScope.scopeType === "city"
				? (currentUserScope.cityMunicipalityCode ?? "")
				: "",
		);
		hasInitializedScopeFilters.current = true;
	}, [currentUserScope, isLguOperator]);

	useEffect(() => {
		setCurrentPage(1);
	}, [
		searchQuery,
		fuelFilter,
		selectedCityMunicipalityCode,
		selectedProvinceCode,
		statusFilter,
		sortBy,
	]);

	useEffect(() => {
		if (stationsLoading) {
			return;
		}

		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, stationsLoading, totalPages]);

	return (
		<>
			<HeroStatus summary={stationSummary ?? null} />
			<SearchFilter
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				fuelFilter={fuelFilter}
				onFuelFilterChange={setFuelFilter}
				statusFilter={statusFilter}
				onStatusFilterChange={setStatusFilter}
				sortBy={sortBy}
				onSortChange={setSortBy}
				provinces={provinces}
				cities={availableCities}
				provinceCode={selectedProvinceCode}
				cityMunicipalityCode={selectedCityMunicipalityCode}
				onProvinceChange={(provinceCode) => {
					setSelectedProvinceCode(provinceCode);
					setSelectedCityMunicipalityCode("");
				}}
				onCityChange={setSelectedCityMunicipalityCode}
			/>
			<StationResultsList
				stations={stations}
				loading={stationsLoading}
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
				activeFuelFilter={fuelFilter}
			/>
		</>
	);
}

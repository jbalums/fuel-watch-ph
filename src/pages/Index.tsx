import { useEffect, useMemo, useRef, useState } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { HeroStatus } from "@/components/HeroStatus";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { mockAlerts } from "@/data/mockStations";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useStationBrowse } from "@/hooks/useStationBrowse";
import { useUserAccess } from "@/hooks/useUserAccess";

const STATIONS_PER_PAGE = 10;

export default function Index() {
	const { isLguOperator } = useUserAccess();
	const { data: currentUserScope } = useCurrentUserScope(isLguOperator);
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
	const { provinces, citiesByProvince } = useGeoReferences();
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
	const [selectedCityMunicipalityCode, setSelectedCityMunicipalityCode] =
		useState("");
	const hasInitializedScopeFilters = useRef(false);
	const availableCities = useMemo(
		() =>
			selectedProvinceCode
				? citiesByProvince.get(selectedProvinceCode) ?? []
				: [],
		[citiesByProvince, selectedProvinceCode],
	);
	const geoFilteredStations = useMemo(() => {
		return filteredStations.filter((station) => {
			if (
				selectedProvinceCode &&
				station.provinceCode !== selectedProvinceCode
			) {
				return false;
			}

			if (
				selectedCityMunicipalityCode &&
				station.cityMunicipalityCode !== selectedCityMunicipalityCode
			) {
				return false;
			}

			return true;
		});
	}, [
		filteredStations,
		selectedCityMunicipalityCode,
		selectedProvinceCode,
	]);
	const totalPages = Math.max(
		1,
		Math.ceil(geoFilteredStations.length / STATIONS_PER_PAGE),
	);
	const activePage = Math.min(currentPage, totalPages);
	const paginatedStations = useMemo(() => {
		const startIndex = (activePage - 1) * STATIONS_PER_PAGE;
		return geoFilteredStations.slice(
			startIndex,
			startIndex + STATIONS_PER_PAGE,
		);
	}, [activePage, geoFilteredStations]);

	useEffect(() => {
		if (!isLguOperator || !currentUserScope || hasInitializedScopeFilters.current) {
			return;
		}

		setSelectedProvinceCode(currentUserScope.provinceCode);
		setSelectedCityMunicipalityCode(
			currentUserScope.scopeType === "city"
				? currentUserScope.cityMunicipalityCode ?? ""
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
				stations={paginatedStations}
				loading={stationsLoading}
				currentPage={activePage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
			/>
		</>
	);
}

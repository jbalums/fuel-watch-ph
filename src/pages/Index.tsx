import { useEffect, useRef, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, MapPin } from "lucide-react";
import { HeroStatus } from "@/components/HeroStatus";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { usePublicStationSummary } from "@/hooks/usePublicStationSummary";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useStationBrowse } from "@/hooks/useStationBrowse";
import { useUserAccess } from "@/hooks/useUserAccess";

const STATIONS_PER_PAGE = 10;
const HOMEPAGE_LOCATION_PROMPT_DISMISSED_KEY =
	"homepage_location_prompt_dismissed";

export default function Index() {
	const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
	const [selectedCityMunicipalityCode, setSelectedCityMunicipalityCode] =
		useState("");
	const [locationPromptOpen, setLocationPromptOpen] = useState(false);
	const [locationPromptDismissed, setLocationPromptDismissed] = useState(
		() => {
			if (typeof window === "undefined") {
				return false;
			}

			return (
				window.localStorage.getItem(
					HOMEPAGE_LOCATION_PROMPT_DISMISSED_KEY,
				) === "true"
			);
		},
	);
	const { isLguOperator } = useUserAccess();
	const {
		coordinates: currentLocation,
		isLoading: locationLoading,
		isRetrying: isRetryingLocation,
		locationError,
		retryLocation,
	} = useCurrentLocation();
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

	useEffect(() => {
		if (currentLocation) {
			setLocationPromptOpen(false);
			return;
		}

		if (locationLoading || locationPromptDismissed || !locationError) {
			return;
		}

		setLocationPromptOpen(true);
	}, [
		currentLocation,
		locationError,
		locationLoading,
		locationPromptDismissed,
	]);

	const handleDismissLocationPrompt = () => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(
				HOMEPAGE_LOCATION_PROMPT_DISMISSED_KEY,
				"true",
			);
		}

		setLocationPromptDismissed(true);
		setLocationPromptOpen(false);
	};

	const handleRetryLocation = async () => {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(
				HOMEPAGE_LOCATION_PROMPT_DISMISSED_KEY,
			);
		}

		setLocationPromptDismissed(false);
		await retryLocation();
	};

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
			<AlertDialog
				open={locationPromptOpen}
				onOpenChange={(open) => {
					if (!open) {
						handleDismissLocationPrompt();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<MapPin className="h-5 w-5 text-primary" />
							Enable location for nearby gas stations
						</AlertDialogTitle>
						<AlertDialogDescription>
							FuelWatch PH uses your location to sort and show the
							nearest gas stations around you. Allow location
							access for a better nearby-station experience.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
						<p>
							You can still browse stations without location, but
							distance-based results may be unavailable.
						</p>
						{locationError ? (
							<p className="mt-2 text-warning">
								Current status: {locationError}
							</p>
						) : null}
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={handleDismissLocationPrompt}
						>
							Not now
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(event) => {
								event.preventDefault();
								void handleRetryLocation();
							}}
							disabled={isRetryingLocation}
						>
							{isRetryingLocation ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Trying again...
								</>
							) : (
								"Try again"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

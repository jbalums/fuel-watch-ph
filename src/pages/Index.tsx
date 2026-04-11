import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";
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
import { Loader2, Map, MapPin } from "lucide-react";
import { HeroStatus } from "@/components/HeroStatus";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { usePublicStationSummary } from "@/hooks/usePublicStationSummary";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useStationBrowse } from "@/hooks/useStationBrowse";
import { useUserAccess } from "@/hooks/useUserAccess";
import { detectGeoScopeFromAddress } from "@/lib/geo-detection";
import {
	formatCoordinate,
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	reverseGeocodeCoordinates,
} from "@/lib/google-maps";

const STATIONS_PER_PAGE = 10;
const HOMEPAGE_LOCATION_PROMPT_DISMISSED_KEY =
	"homepage_location_prompt_dismissed";

export default function Index() {
	const navigate = useNavigate();
	const { isLoaded: isGoogleMapsLoaded, loadError: googleMapsLoadError } =
		useJsApiLoader({
			id: GOOGLE_MAPS_SCRIPT_ID,
			googleMapsApiKey: GOOGLE_MAPS_API_KEY,
			libraries: GOOGLE_MAPS_LIBRARIES,
			preventGoogleFontsLoading: true,
		});
	const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
	const [selectedCityMunicipalityCode, setSelectedCityMunicipalityCode] =
		useState("");
	const [locationPromptOpen, setLocationPromptOpen] = useState(false);
	const [autoDetectedProvinceCode, setAutoDetectedProvinceCode] =
		useState("");
	const [detectedLocationAddress, setDetectedLocationAddress] = useState("");
	const [isResolvingLocationAddress, setIsResolvingLocationAddress] =
		useState(false);
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
	const shouldLoadAllCitiesForDetection = !isLguOperator && !!currentLocation;
	const { provinces, cities, citiesByProvince } = useGeoReferences({
		provinceCode: selectedProvinceCode,
		includeAllCities: shouldLoadAllCitiesForDetection,
	});
	const { data: stationSummary } = usePublicStationSummary();
	const [currentPage, setCurrentPage] = useState(1);
	const hasInitializedScopeFilters = useRef(false);
	const hasAttemptedProvinceDetectionRef = useRef(false);
	const hasManualLocationOverrideRef = useRef(false);
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
		if (!currentLocation) {
			setDetectedLocationAddress("");
			setIsResolvingLocationAddress(false);
			return;
		}

		if (
			GOOGLE_MAPS_API_KEY &&
			!isGoogleMapsLoaded &&
			!googleMapsLoadError
		) {
			setIsResolvingLocationAddress(true);
			setDetectedLocationAddress(
				`${formatCoordinate(currentLocation.lat)}, ${formatCoordinate(
					currentLocation.lng,
				)}`,
			);
			return;
		}

		let isCancelled = false;

		const syncDetectedLocation = async () => {
			setIsResolvingLocationAddress(true);

			try {
				const address =
					googleMapsLoadError || !GOOGLE_MAPS_API_KEY
						? null
						: await reverseGeocodeCoordinates(currentLocation);
				if (isCancelled) {
					return;
				}

				setDetectedLocationAddress(
					address ||
						`${formatCoordinate(currentLocation.lat)}, ${formatCoordinate(
							currentLocation.lng,
						)}`,
				);

				if (isLguOperator || provinces.length === 0) {
					return;
				}

				if (
					hasAttemptedProvinceDetectionRef.current ||
					hasManualLocationOverrideRef.current
				) {
					return;
				}

				if (selectedProvinceCode) {
					hasAttemptedProvinceDetectionRef.current = true;
					return;
				}

				hasAttemptedProvinceDetectionRef.current = true;

				if (!address) {
					return;
				}

				const detectedScope = detectGeoScopeFromAddress({
					address,
					provinces,
					cities,
				});

				if (!detectedScope?.provinceCode || isCancelled) {
					return;
				}

				setSelectedProvinceCode(detectedScope.provinceCode);
				setSelectedCityMunicipalityCode("");
				setAutoDetectedProvinceCode(detectedScope.provinceCode);
			} catch (error) {
				if (!isCancelled) {
					setDetectedLocationAddress(
						`${formatCoordinate(currentLocation.lat)}, ${formatCoordinate(
							currentLocation.lng,
						)}`,
					);
					console.error(
						"Failed to sync homepage location details",
						error,
					);
				}
			} finally {
				if (!isCancelled) {
					setIsResolvingLocationAddress(false);
				}
			}
		};

		void syncDetectedLocation();

		return () => {
			isCancelled = true;
		};
	}, [
		currentLocation,
		googleMapsLoadError,
		isGoogleMapsLoaded,
		isLguOperator,
		cities,
		provinces,
		selectedProvinceCode,
	]);

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

		hasAttemptedProvinceDetectionRef.current = false;
		setLocationPromptDismissed(false);
		await retryLocation();
	};

	const detectedProvinceName =
		provinces.find((province) => province.code === autoDetectedProvinceCode)
			?.name ?? "";
	const shouldShowMapFallback =
		!stationsLoading &&
		stations.length === 0 &&
		!!currentLocation &&
		!!autoDetectedProvinceCode &&
		selectedProvinceCode === autoDetectedProvinceCode;
	const emptyMessage = shouldShowMapFallback
		? "We couldn't find listed stations yet in your current province. Open the live map to explore a wider area and discover nearby fuel stations."
		: "No stations found matching your criteria.";

	const handleOpenMapFallback = () => {
		const params = new URLSearchParams();
		if (selectedProvinceCode) {
			params.set("provinceCode", selectedProvinceCode);
		}
		if (selectedCityMunicipalityCode) {
			params.set("cityMunicipalityCode", selectedCityMunicipalityCode);
		}

		navigate({
			pathname: "/map",
			search: params.toString() ? `?${params.toString()}` : "",
		});
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
				autoOpenGeoFiltersOnActive={false}
				onProvinceChange={(provinceCode) => {
					hasManualLocationOverrideRef.current = true;
					setAutoDetectedProvinceCode("");
					setSelectedProvinceCode(provinceCode);
					setSelectedCityMunicipalityCode("");
				}}
				onCityChange={(cityCode) => {
					hasManualLocationOverrideRef.current = true;
					setSelectedCityMunicipalityCode(cityCode);
				}}
			/>

			{stations.length === 0 &&
			detectedProvinceName &&
			selectedProvinceCode === autoDetectedProvinceCode ? (
				<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
					Showing stations in your current province:{" "}
					<span className="font-semibold">
						{detectedProvinceName}
					</span>
				</div>
			) : null}
			<StationResultsList
				stations={stations}
				loading={stationsLoading}
				emptyMessage={emptyMessage}
				emptyActionLabel={
					shouldShowMapFallback ? (
						<div className="flex items-center justify-center gap-2">
							<Map className="h-10 w-10" /> Go to Map
						</div>
					) : undefined
				}
				onEmptyAction={
					shouldShowMapFallback ? handleOpenMapFallback : undefined
				}
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

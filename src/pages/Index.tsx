import { useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2, Map, MapPin } from "lucide-react";
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
const HOMEPAGE_PROVINCE_PROMPT_DISMISSED_KEY =
	"homepage_province_prompt_dismissed";

export default function Index() {
	const navigate = useNavigate();
	const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
	const [selectedCityMunicipalityCode, setSelectedCityMunicipalityCode] =
		useState("");
	const [locationPromptOpen, setLocationPromptOpen] = useState(false);
	const [provincePromptOpen, setProvincePromptOpen] = useState(false);
	const [provincePromptPopoverOpen, setProvincePromptPopoverOpen] =
		useState(false);
	const [pendingProvinceCode, setPendingProvinceCode] = useState("");
	const [confirmedCurrentProvinceCode, setConfirmedCurrentProvinceCode] =
		useState("");
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
	const [provincePromptDismissed, setProvincePromptDismissed] = useState(
		() => {
			if (typeof window === "undefined") {
				return false;
			}

			return (
				window.localStorage.getItem(
					HOMEPAGE_PROVINCE_PROMPT_DISMISSED_KEY,
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
		if (
			!currentLocation ||
			isLguOperator ||
			selectedProvinceCode ||
			provincePromptDismissed ||
			hasManualLocationOverrideRef.current
		) {
			setProvincePromptOpen(false);
			return;
		}

		if (provinces.length === 0) {
			return;
		}

		setProvincePromptOpen(true);
	}, [
		currentLocation,
		isLguOperator,
		provincePromptDismissed,
		provinces.length,
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
			window.localStorage.removeItem(
				HOMEPAGE_PROVINCE_PROMPT_DISMISSED_KEY,
			);
		}

		setLocationPromptDismissed(false);
		setProvincePromptDismissed(false);
		await retryLocation();
	};

	const selectedProvinceName =
		provinces.find((province) => province.code === selectedProvinceCode)
			?.name ?? "";
	const confirmedCurrentProvinceName =
		provinces.find(
			(province) => province.code === confirmedCurrentProvinceCode,
		)?.name ?? "";
	const selectedProvinceOption = useMemo(
		() =>
			provinces.find((province) => province.code === pendingProvinceCode) ??
			null,
		[pendingProvinceCode, provinces],
	);
	const shouldShowMapFallback =
		!stationsLoading &&
		stations.length === 0 &&
		!!currentLocation &&
		!!confirmedCurrentProvinceCode &&
		selectedProvinceCode === confirmedCurrentProvinceCode;
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

	const handleDismissProvincePrompt = () => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(
				HOMEPAGE_PROVINCE_PROMPT_DISMISSED_KEY,
				"true",
			);
		}

		setProvincePromptDismissed(true);
		setProvincePromptOpen(false);
		setProvincePromptPopoverOpen(false);
	};

	const handleConfirmProvincePrompt = () => {
		if (!pendingProvinceCode) {
			return;
		}

		if (typeof window !== "undefined") {
			window.localStorage.setItem(
				HOMEPAGE_PROVINCE_PROMPT_DISMISSED_KEY,
				"true",
			);
		}

		hasManualLocationOverrideRef.current = true;
		setSelectedProvinceCode(pendingProvinceCode);
		setSelectedCityMunicipalityCode("");
		setConfirmedCurrentProvinceCode(pendingProvinceCode);
		setProvincePromptDismissed(true);
		setProvincePromptOpen(false);
		setProvincePromptPopoverOpen(false);
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
					setConfirmedCurrentProvinceCode("");
					setSelectedProvinceCode(provinceCode);
					setSelectedCityMunicipalityCode("");
				}}
				onCityChange={(cityCode) => {
					hasManualLocationOverrideRef.current = true;
					setSelectedCityMunicipalityCode(cityCode);
				}}
			/>

			{stations.length === 0 &&
			confirmedCurrentProvinceName &&
			selectedProvinceCode === confirmedCurrentProvinceCode ? (
				<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
					Showing stations in your current province:{" "}
					<span className="font-semibold">
						{confirmedCurrentProvinceName}
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
			<AlertDialog
				open={provincePromptOpen}
				onOpenChange={(open) => {
					if (!open) {
						handleDismissProvincePrompt();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<MapPin className="h-5 w-5 text-primary" />
							Which province are you currently in?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Choose your current province so FuelWatch PH can
							show stations near you without using extra Google
							Maps location lookups.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
						<div className="space-y-1.5">
							<label className="text-sm font-medium text-foreground">
								Current province
							</label>
							<Popover
								open={provincePromptPopoverOpen}
								onOpenChange={setProvincePromptPopoverOpen}
							>
								<PopoverTrigger asChild>
									<Button
										type="button"
										variant="outline"
										role="combobox"
										aria-expanded={provincePromptPopoverOpen}
										className={cn(
											"h-auto min-h-12 w-full justify-between rounded-xl border-border bg-background px-4 py-3 text-sm font-normal text-foreground hover:bg-background",
											!selectedProvinceOption &&
												"text-muted-foreground",
										)}
									>
										<span className="truncate text-left">
											{selectedProvinceOption?.name ??
												"Select your current province"}
										</span>
										<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
									<Command>
										<CommandInput placeholder="Search provinces..." />
										<CommandList>
											<CommandEmpty>
												No provinces found.
											</CommandEmpty>
											{provinces.map((province) => (
												<CommandItem
													key={province.code}
													value={`${province.name} ${province.code}`}
													onSelect={() => {
														setPendingProvinceCode(
															province.code,
														);
														setProvincePromptPopoverOpen(
															false,
														);
													}}
												>
													<Check
														className={cn(
															"mr-2 h-4 w-4",
															pendingProvinceCode ===
																province.code
																? "opacity-100"
																: "opacity-0",
														)}
													/>
													{province.name}
												</CommandItem>
											))}
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
						<p className="text-xs text-muted-foreground">
							You can change this anytime from the homepage
							location filter.
						</p>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={handleDismissProvincePrompt}
						>
							Not now
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(event) => {
								event.preventDefault();
								handleConfirmProvincePrompt();
							}}
							disabled={!pendingProvinceCode}
						>
							Use this province
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

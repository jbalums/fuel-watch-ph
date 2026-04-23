import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
} from "@react-google-maps/api";
import {
	AlertTriangle,
	Check,
	ChevronsUpDown,
	Crosshair,
	ExternalLink,
	Loader2,
	MapPinned,
	Search,
	WandSparkles,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { GeoScopeFields } from "@/components/GeoScopeFields";
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
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useStationBrandLogos } from "@/hooks/useStationBrandLogos";
import { detectGeoScopeFromAddress } from "@/lib/geo-detection";
import { buildResolvedStationMarkerIcon } from "@/lib/station-brand-logos";
import { fuelTypes } from "@/lib/fuel-prices";
import {
	buildDiscoveredStationForm,
	buildAddressSearchText,
	dedupeDiscoveredStations,
	formatLatLng,
	getResolvedDiscoveredStationAddress,
	getDiscoveredStationAutoCreateBrand,
	getDuplicateLabel,
	getDuplicateMatch,
	getDuplicateMessage,
	resolveDiscoveredStationAddress,
	searchDiscoveredFuelStationsInBounds,
	type DuplicateMatch,
	type DiscoveredStation,
} from "@/lib/station-discovery";
import {
	buildStationLguVerificationPayload,
	buildStationPayload,
	initialStationForm,
	type GasStationRow,
	type StationFormState,
	refreshAdminData,
	useAdminStations,
} from "@/components/admin/admin-shared";
import {
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_CONTAINER_STYLE,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	MANILA_CENTER,
} from "@/lib/google-maps";
import { cn } from "@/lib/utils";

const DEFAULT_DISCOVERY_ZOOM = 15;
const SELECTED_RESULT_ZOOM = 17;

type ResultAutoCreateStatus =
	| "eligible"
	| "duplicate"
	| "missing_scope"
	| "unsupported_brand";

type ResultAssessment = {
	duplicateMatch: DuplicateMatch | null;
	detectedScope: {
		provinceCode: string;
		cityMunicipalityCode: string;
	} | null;
	matchedBrand: string | null;
	status: ResultAutoCreateStatus;
};

function SearchableResultsScopeSelect({
	label,
	placeholder,
	searchPlaceholder,
	emptyLabel,
	options,
	value,
	disabled = false,
	onChange,
}: {
	label: string;
	placeholder: string;
	searchPlaceholder: string;
	emptyLabel: string;
	options: Array<{ code: string; name: string }>;
	value: string;
	disabled?: boolean;
	onChange: (nextValue: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const selectedOption =
		options.find((option) => option.code === value) ?? null;

	return (
		<div className="flex flex-col gap-1.5">
			<label className="text-label text-muted-foreground">{label}</label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className={cn(
							"h-auto min-h-12 w-full justify-between rounded-xl border-border bg-background px-4 py-3 text-sm font-normal text-foreground hover:bg-background hover:text-primary",
							!selectedOption && "text-muted-foreground",
						)}
					>
						<span className="truncate text-left">
							{selectedOption?.name ?? placeholder}
						</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
					<Command>
						<CommandInput placeholder={searchPlaceholder} />
						<CommandList>
							<CommandEmpty>{emptyLabel}</CommandEmpty>
							<CommandItem
								value={`All ${label}`}
								onSelect={() => {
									onChange("");
									setOpen(false);
								}}
							>
								<Check
									className={cn(
										"mr-2 h-4 w-4",
										!value ? "opacity-100" : "opacity-0",
									)}
								/>
								{`All ${label}`}
							</CommandItem>
							{options.map((option) => (
								<CommandItem
									key={option.code}
									value={`${option.name} ${option.code}`}
									onSelect={() => {
										onChange(option.code);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											value === option.code
												? "opacity-100"
												: "opacity-0",
										)}
									/>
									{option.name}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}

function getAssessmentLabel(assessment: ResultAssessment) {
	switch (assessment.status) {
		case "eligible":
			return "Supported for auto-create";
		case "duplicate":
			return "Skipped by auto-create";
		case "missing_scope":
			return "Missing location scope";
		case "unsupported_brand":
			return "Unsupported for auto-create";
	}
}

function getAssessmentTone(assessment: ResultAssessment) {
	switch (assessment.status) {
		case "eligible":
			return "bg-success/15 text-success";
		case "duplicate":
			return "bg-warning/15 text-warning";
		case "missing_scope":
			return "bg-warning/15 text-warning";
		case "unsupported_brand":
			return "bg-secondary text-muted-foreground";
	}
}

function getAssessmentMessage(assessment: ResultAssessment) {
	if (assessment.status === "eligible" && assessment.matchedBrand) {
		return assessment.detectedScope?.cityMunicipalityCode
			? `${assessment.matchedBrand} matched. Province and city were detected.`
			: `${assessment.matchedBrand} matched. Province is set; city is optional for discovery create.`;
	}

	if (assessment.status === "duplicate") {
		return "This station already matches an existing local station and will be skipped.";
	}

	if (assessment.status === "missing_scope") {
		return "Province could not be resolved yet. Pick a province above to continue.";
	}

	return "Only supported brand names are auto-created. You can still create this one manually.";
}

function DiscoveryStationForm({
	form,
	provinces,
	visibleCities,
	isSaving,
	duplicateMatch,
	onFormChange,
	onSubmit,
	onOpenExistingStation,
}: {
	form: StationFormState;
	provinces: ReturnType<typeof useGeoReferences>["provinces"];
	visibleCities: ReturnType<typeof useGeoReferences>["cities"];
	isSaving: boolean;
	duplicateMatch: DuplicateMatch | null;
	onFormChange: (
		updater:
			| StationFormState
			| ((current: StationFormState) => StationFormState),
	) => void;
	onSubmit: () => void;
	onOpenExistingStation: (stationId: string) => void;
}) {
	const { data: stationBrandLogos = [] } = useStationBrandLogos();

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						Create Station
					</h3>
					<p className="text-sm text-muted-foreground">
						Discovery results prefill the station details. Complete the
						local fuel data before saving.
					</p>
				</div>
				<span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
					{form.googlePlaceId ? "Google Place ID linked" : "OpenStreetMap discovery"}
				</span>
			</div>

			{duplicateMatch ? (
				<div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
						<div className="min-w-0 flex-1">
							<p className="font-medium text-foreground">
								{getDuplicateLabel(duplicateMatch)}
							</p>
							<p className="mt-1 text-muted-foreground">
								{getDuplicateMessage(duplicateMatch)}
							</p>
							<div className="mt-3 rounded-lg border border-border/70 bg-background/80 p-3">
								<p className="font-medium text-foreground">
									{duplicateMatch.station.name}
								</p>
								<p className="text-sm text-muted-foreground">
									{duplicateMatch.station.address}
								</p>
							</div>
							<div className="mt-3">
								<Button
									type="button"
									variant="outline"
									onClick={() =>
										onOpenExistingStation(
											duplicateMatch.station.id,
										)
									}
								>
									<ExternalLink className="h-4 w-4" />
									Open Existing Station
								</Button>
							</div>
						</div>
					</div>
				</div>
			) : null}

			<form
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
				}}
				className="flex flex-col gap-4"
			>
				<div className="grid gap-3 md:grid-cols-2">
					<input
						type="text"
						placeholder="Station name"
						value={form.name}
						onChange={(event) =>
							onFormChange((current) => ({
								...current,
								name: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<input
						type="text"
						placeholder="Address"
						value={form.address}
						onChange={(event) =>
							onFormChange((current) => ({
								...current,
								address: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<input
						type="number"
						step="0.000001"
						placeholder="Latitude"
						value={form.lat}
						onChange={(event) =>
							onFormChange((current) => ({
								...current,
								lat: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
					<input
						type="number"
						step="0.000001"
						placeholder="Longitude"
						value={form.lng}
						onChange={(event) =>
							onFormChange((current) => ({
								...current,
								lng: event.target.value,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
				</div>

				<div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm">
					<p className="font-medium text-foreground">
						Google Place ID
					</p>
					<p className="mt-1 break-all text-muted-foreground">
						{form.googlePlaceId || "Not available for OpenStreetMap discovery"}
					</p>
				</div>

				<div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm">
					<p className="font-medium text-foreground">
						Marker Logo Override
					</p>
					<p className="mt-1 text-muted-foreground">
						Leave this on auto-match to resolve the marker logo from
						the station name, or choose a brand to override it.
					</p>
					<select
						value={form.stationBrandLogoId}
						onChange={(event) =>
							onFormChange((current) => ({
								...current,
								stationBrandLogoId: event.target.value,
							}))
						}
						className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						<option value="">Auto-match from station name</option>
						{stationBrandLogos.map((brandLogo) => (
							<option key={brandLogo.id} value={brandLogo.id}>
								{brandLogo.brandName}
							</option>
						))}
					</select>
				</div>

				<GeoScopeFields
					provinces={provinces}
					cities={visibleCities}
					provinceCode={form.provinceCode}
					cityMunicipalityCode={form.cityMunicipalityCode}
					onProvinceChange={(provinceCode) =>
						onFormChange((current) => ({
							...current,
							provinceCode,
							cityMunicipalityCode: "",
						}))
					}
					onCityChange={(cityMunicipalityCode) =>
						onFormChange((current) => ({
							...current,
							cityMunicipalityCode,
						}))
					}
				/>

				<div className="rounded-lg border border-border bg-background p-3">
					<div className="mb-3">
						<div>
							<p className="text-sm font-medium text-foreground">
								Current Prices
							</p>
							<p className="text-xs text-muted-foreground">
								Leave these blank if you are only creating the
								station shell for now. The main displayed fuel
								is derived automatically once real pricing is
								added later.
							</p>
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
						{fuelTypes.map((fuelType) => (
							<div
								key={fuelType}
								className="flex flex-col gap-1.5"
							>
								<label className="text-xs font-medium text-muted-foreground">
									{fuelType}
								</label>
								<input
									type="number"
									step="0.01"
									placeholder="0.00"
									value={form.prices[fuelType]}
									onChange={(event) =>
										onFormChange((current) => ({
											...current,
											prices: {
												...current.prices,
												[fuelType]: event.target.value,
											},
										}))
									}
									className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
								/>
							</div>
						))}
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						Optional for station discovery. Add prices only when you
						already have verified fuel data. Blank fields are
						ignored.
					</p>
				</div>

				<div className="rounded-lg border border-border bg-background p-3">
					<div className="mb-3">
						<p className="text-sm font-medium text-foreground">
							Previous Prices
						</p>
						<p className="text-xs text-muted-foreground">
							Optional values for seeding price-trend history.
						</p>
					</div>
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
						{fuelTypes.map((fuelType) => (
							<div
								key={`${fuelType}-previous`}
								className="flex flex-col gap-1.5"
							>
								<label className="text-xs font-medium text-muted-foreground">
									{fuelType}
								</label>
								<input
									type="number"
									step="0.01"
									placeholder="0.00"
									value={form.previousPrices[fuelType]}
									onChange={(event) =>
										onFormChange((current) => ({
											...current,
											previousPrices: {
												...current.previousPrices,
												[fuelType]: event.target.value,
											},
										}))
									}
									className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
								/>
							</div>
						))}
					</div>
				</div>

				<div className="flex justify-end">
					<Button
						type="submit"
						disabled={isSaving || !!duplicateMatch}
					>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Saving Station
							</>
						) : (
							"Create Station"
						)}
					</Button>
				</div>
			</form>
		</div>
	);
}

function GoogleDiscoveryMap({
	stations,
	initialGoogleStation = null,
}: {
	stations: GasStationRow[];
	initialGoogleStation?: DiscoveredStation | null;
}) {
	const { data: stationBrandLogos = [] } = useStationBrandLogos();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { accessLevel } = useUserAccess();
	const { coordinates: currentLocation } = useCurrentLocation();
	const [map, setMap] = useState<google.maps.Map | null>(null);
	const [results, setResults] = useState<DiscoveredStation[]>([]);
	const [selectedResultId, setSelectedResultId] = useState<string | null>(
		null,
	);
	const [resultsProvinceFilter, setResultsProvinceFilter] = useState("");
	const [resultsCityFilter, setResultsCityFilter] = useState("");
	const [resultScopeOverrides, setResultScopeOverrides] = useState<
		Record<
			string,
			{
				provinceCode: string;
				cityMunicipalityCode: string;
			}
		>
	>({});
	const [stationForm, setStationForm] =
		useState<StationFormState>(initialStationForm);
	const [isSearching, setIsSearching] = useState(false);
	const [isPrefilling, setIsPrefilling] = useState(false);
	const [isResolvingSelectedResultAddress, setIsResolvingSelectedResultAddress] =
		useState(false);
	const [isAutoDetectingScopes, setIsAutoDetectingScopes] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const { provinces, cities, citiesByProvince } = useGeoReferences({
		provinceCode: resultsProvinceFilter || stationForm.provinceCode,
		includeAllCities: false,
	});

	const mapCenter = currentLocation ?? MANILA_CENTER;
	const normalizedStations = useMemo(
		() =>
			stations.map((station) => ({
				id: station.id,
				name: station.name,
				address: station.address,
				lat: station.lat,
				lng: station.lng,
				googlePlaceId: station.google_place_id,
			})),
		[stations],
	);
	const filteredCities = useMemo(
		() =>
			resultsProvinceFilter
				? (citiesByProvince.get(resultsProvinceFilter) ?? [])
				: [],
		[citiesByProvince, resultsProvinceFilter],
	);

	const duplicateMatches = useMemo(() => {
		return new Map(
			results.map((result) => [
				result.externalId,
				getDuplicateMatch(result, normalizedStations),
			]),
		);
	}, [normalizedStations, results]);

	const resultAssessments = useMemo(() => {
		return new Map<string, ResultAssessment>(
			results.map((result) => {
				const duplicateMatch =
					duplicateMatches.get(result.externalId) ?? null;
				const detectedScope =
					resultScopeOverrides[result.externalId] ??
					(() => {
						if (resultsProvinceFilter) {
							return {
								provinceCode: resultsProvinceFilter,
								cityMunicipalityCode: resultsCityFilter,
							};
						}

						const autoDetectedScope = detectGeoScopeFromAddress({
							address: buildAddressSearchText(result),
							provinces,
							cities,
						});

						return autoDetectedScope;
					})();
				const matchedBrand = getDiscoveredStationAutoCreateBrand(
					result.name,
				);
				let status: ResultAutoCreateStatus = "eligible";

				if (duplicateMatch) {
					status = "duplicate";
				} else if (!detectedScope?.provinceCode) {
					status = "missing_scope";
				} else if (!matchedBrand) {
					status = "unsupported_brand";
				}

				return [
					result.externalId,
					{
						duplicateMatch,
						detectedScope: detectedScope?.provinceCode
							? {
									provinceCode: detectedScope.provinceCode,
									cityMunicipalityCode:
										detectedScope.cityMunicipalityCode ??
										"",
								}
							: null,
						matchedBrand,
						status,
					},
				];
			}),
		);
	}, [
		cities,
		duplicateMatches,
		provinces,
		resultScopeOverrides,
		results,
		resultsCityFilter,
		resultsProvinceFilter,
	]);

	const autoCreateSummary = useMemo(() => {
		return results.reduce(
			(summary, result) => {
				const assessment =
					resultAssessments.get(result.externalId) ?? null;
				if (!assessment) {
					return summary;
				}

				summary[assessment.status] += 1;
				return summary;
			},
			{
				eligible: 0,
				duplicate: 0,
				missing_scope: 0,
				unsupported_brand: 0,
			},
		);
	}, [resultAssessments, results]);

	const selectedResult = selectedResultId
		? (results.find((result) => result.externalId === selectedResultId) ??
			null)
		: null;
	const selectedDuplicateMatch = selectedResultId
		? (resultAssessments.get(selectedResultId)?.duplicateMatch ?? null)
		: null;
	const visibleCities = stationForm.provinceCode
		? (citiesByProvince.get(stationForm.provinceCode) ?? [])
		: [];

	const saveStation = useMutation({
		mutationFn: async () => {
			const payload = {
				...buildStationPayload(stationForm, null, {
					allowEmptyPricing: true,
					allowProvinceOnlyScope: true,
				}),
				...buildStationLguVerificationPayload(accessLevel, user?.id),
			};

			const { error } = await supabase.from("gas_stations").insert({
				...payload,
				report_count: 0,
			});

			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await refreshAdminData(queryClient);
			toast.success("Station created from discovery results");
			setSelectedResultId(null);
			setIsResolvingSelectedResultAddress(false);
			setStationForm(initialStationForm);
		},
		onError: (error) => toast.error(error.message),
	});

	const autoDetectAllResultScopes = useCallback(() => {
		if (results.length === 0) {
			return;
		}

		setIsAutoDetectingScopes(true);
		try {
			const nextOverrides: Record<
				string,
				{
					provinceCode: string;
					cityMunicipalityCode: string;
				}
			> = {};
			let detectedCount = 0;
			let missingCount = 0;

			for (const result of results) {
				const detectedScope = detectGeoScopeFromAddress({
					address: buildAddressSearchText(result),
					provinces,
					cities,
				});

				if (
					detectedScope?.provinceCode &&
					detectedScope?.cityMunicipalityCode
				) {
					nextOverrides[result.externalId] = {
						provinceCode: detectedScope.provinceCode,
						cityMunicipalityCode:
							detectedScope.cityMunicipalityCode,
					};
					detectedCount += 1;
					continue;
				}

				missingCount += 1;
			}

			setResultScopeOverrides(nextOverrides);

			if (selectedResultId) {
				const selectedResult = results.find(
					(result) => result.externalId === selectedResultId,
				);
				const selectedScope =
					selectedResult && nextOverrides[selectedResult.externalId];

				if (selectedResult && selectedScope) {
					setStationForm((current) => ({
						...current,
						provinceCode: selectedScope.provinceCode,
						cityMunicipalityCode:
							selectedScope.cityMunicipalityCode,
					}));
				}
			}

			toast.info(
				[
					`Auto-detected scope for ${detectedCount} station${detectedCount === 1 ? "" : "s"}.`,
					missingCount > 0
						? `${missingCount} still need manual province selection.`
						: null,
				]
					.filter(Boolean)
					.join(" "),
			);
		} finally {
			setIsAutoDetectingScopes(false);
		}
	}, [cities, provinces, results, selectedResultId]);

	const handleResultsProvinceFilterChange = useCallback(
		(provinceCode: string) => {
			setResultsProvinceFilter(provinceCode);
			setResultsCityFilter("");

			if (selectedResultId) {
				setStationForm((current) => ({
					...current,
					provinceCode,
					cityMunicipalityCode: "",
				}));
			}
		},
		[selectedResultId],
	);

	const handleResultsCityFilterChange = useCallback(
		(cityMunicipalityCode: string) => {
			setResultsCityFilter(cityMunicipalityCode);

			if (selectedResultId) {
				setStationForm((current) => ({
					...current,
					cityMunicipalityCode,
				}));
			}
		},
		[selectedResultId],
	);

	const autoCreateStations = useMutation({
		mutationFn: async () => {
			const eligibleResults = results.filter((result) => {
				const assessment =
					resultAssessments.get(result.externalId) ?? null;
				return assessment?.status === "eligible";
			});

			const summary = {
				created: 0,
				duplicate: autoCreateSummary.duplicate,
				missingScope: autoCreateSummary.missing_scope,
				unsupportedBrand: autoCreateSummary.unsupported_brand,
			};

			if (eligibleResults.length === 0) {
				return summary;
			}

			const stationRows = eligibleResults.map((result) => {
				const assessment = resultAssessments.get(result.externalId);
				if (!assessment?.detectedScope?.provinceCode) {
					throw new Error(
						"Auto Create could not resolve a valid province for one of the selected discovered stations.",
					);
				}

				const form = buildDiscoveredStationForm(
					result,
					assessment.detectedScope,
				);

				return {
					...buildStationPayload(form, null, {
						allowEmptyPricing: true,
						allowProvinceOnlyScope: true,
					}),
					...buildStationLguVerificationPayload(
						accessLevel,
						user?.id,
					),
					report_count: 0,
				};
			});

			const { error } = await supabase
				.from("gas_stations")
				.insert(stationRows);

			if (error) {
				throw error;
			}

			summary.created = stationRows.length;
			return summary;
		},
		onSuccess: async (summary) => {
			await refreshAdminData(queryClient);
			setSelectedResultId(null);
			setStationForm(initialStationForm);

			if (summary.created > 0) {
				toast.success(
					[
						`Created ${summary.created} station${summary.created === 1 ? "" : "s"}.`,
						summary.unsupportedBrand > 0
							? `Skipped ${summary.unsupportedBrand} unsupported brand${summary.unsupportedBrand === 1 ? "" : "s"}.`
							: null,
						summary.duplicate > 0
							? `Skipped ${summary.duplicate} duplicate${summary.duplicate === 1 ? "" : "s"}.`
							: null,
						summary.missingScope > 0
							? `Skipped ${summary.missingScope} missing location scope.`
							: null,
					]
						.filter(Boolean)
						.join(" "),
				);
				return;
			}

			toast.info(
				[
					"No eligible stations were auto-created.",
					summary.unsupportedBrand > 0
						? `${summary.unsupportedBrand} unsupported brand${summary.unsupportedBrand === 1 ? "" : "s"}.`
						: null,
					summary.duplicate > 0
						? `${summary.duplicate} duplicate${summary.duplicate === 1 ? "" : "s"}.`
						: null,
					summary.missingScope > 0
						? `${summary.missingScope} missing location scope.`
						: null,
				]
					.filter(Boolean)
					.join(" "),
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const searchCurrentArea = useCallback(async () => {
		if (!map) {
			setSearchError("The map is not ready yet. Try again in a moment.");
			return;
		}

		const bounds = map.getBounds();
		if (!bounds) {
			setSearchError("Move the map a little, then try searching again.");
			return;
		}

		setIsSearching(true);
		setSearchError(null);
		try {
			const normalizedResults =
				await searchDiscoveredFuelStationsInBounds(bounds);

			setResults(normalizedResults);
			setSearchError(
				normalizedResults.length === 0
					? "No fuel stations were found in the current map area."
					: null,
			);
		} catch (error) {
			setResults([]);
			setSearchError(
				error instanceof Error
					? error.message
					: "OpenStreetMap discovery could not load stations for this area right now.",
			);
		} finally {
			setIsSearching(false);
		}
	}, [map]);

	const handleSelectResult = useCallback(
		(result: DiscoveredStation) => {
			setSelectedResultId(result.externalId);
			if (map) {
				map.panTo({ lat: result.lat, lng: result.lng });
				map.setZoom(SELECTED_RESULT_ZOOM);
			}

			setIsPrefilling(true);
			try {
				const detectedScope = resultAssessments.get(
					result.externalId,
				)?.detectedScope;

				setStationForm(
					buildDiscoveredStationForm(result, detectedScope),
				);
			} finally {
				setIsPrefilling(false);
			}

			const cachedAddress = getResolvedDiscoveredStationAddress(
				result.externalId,
			);
			if (cachedAddress && cachedAddress === result.address) {
				setIsResolvingSelectedResultAddress(false);
				return;
			}

			setIsResolvingSelectedResultAddress(true);
			void resolveDiscoveredStationAddress(result)
				.then((resolvedResult) => {
					setResults((current) =>
						current.map((entry) =>
							entry.externalId === resolvedResult.externalId
								? resolvedResult
								: entry,
						),
					);

					setStationForm((current) => {
						if (
							current.lat !== formatLatLng(resolvedResult.lat) ||
							current.lng !== formatLatLng(resolvedResult.lng)
						) {
							return current;
						}

						return {
							...current,
							address: resolvedResult.address,
						};
					});
				})
				.catch((error) => {
					console.error(
						"Failed to reverse geocode selected discovered station",
						error,
					);
				})
				.finally(() => {
					setIsResolvingSelectedResultAddress(false);
				});
		},
		[map, resultAssessments],
	);

	useEffect(() => {
		if (!initialGoogleStation || selectedResultId || isPrefilling) {
			return;
		}

		setResults((current) => {
			if (
				current.some(
					(result) =>
						result.externalId ===
						initialGoogleStation.externalId,
				)
			) {
				return current;
			}

			return dedupeDiscoveredStations([initialGoogleStation, ...current]);
		});
		handleSelectResult(initialGoogleStation);
	}, [
		handleSelectResult,
		initialGoogleStation,
		isPrefilling,
		selectedResultId,
	]);

	const openExistingStation = useCallback(
		(stationId: string) => {
			navigate(`/admin/stations?edit=${stationId}`);
		},
		[navigate],
	);

	useEffect(() => {
		if (!selectedResultId) {
			setIsResolvingSelectedResultAddress(false);
			return;
		}

		const selectedStillExists = results.some(
			(result) => result.externalId === selectedResultId,
		);
		if (!selectedStillExists) {
			setSelectedResultId(null);
			setStationForm(initialStationForm);
		}
	}, [results, selectedResultId]);

	return (
		<div className="grid gap-6 grid-cols-1">
			<div className="grid grid-cols-1 lg:grid-cols-2  gap-4">
				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<h3 className="text-xl font-semibold text-foreground">
								Fuel Station Discovery
							</h3>
							<p className="text-sm text-muted-foreground">
								Move the map to the area you want, then search
								OpenStreetMap for fuel stations inside the current
								view.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								onClick={searchCurrentArea}
								disabled={isSearching}
							>
								{isSearching ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Searching area
									</>
								) : (
									<>
										<Search className="h-4 w-4" />
										Search this area
									</>
								)}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => autoCreateStations.mutate()}
								disabled={
									autoCreateStations.isPending ||
									results.length === 0
								}
							>
								{autoCreateStations.isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Auto creating
									</>
								) : (
									<>
										<WandSparkles className="h-4 w-4" />
										Auto Create
									</>
								)}
							</Button>
						</div>
					</div>

					<div className="mt-4 overflow-hidden rounded-2xl border border-border">
						<GoogleMap
							mapContainerStyle={{
								...GOOGLE_MAPS_CONTAINER_STYLE,
								height: "520px",
							}}
							center={mapCenter}
							zoom={DEFAULT_DISCOVERY_ZOOM}
							onLoad={(googleMap) => {
								setMap(googleMap);
								setSearchError(null);
							}}
							onUnmount={() => {
								setMap(null);
							}}
							options={{
								fullscreenControl: true,
								mapTypeControl: true,
								streetViewControl: false,
								gestureHandling: "greedy",
							}}
						>
							{results.map((result) => {
								const isSelected =
									result.externalId === selectedResultId;
								return (
									<MarkerF
										key={result.externalId}
										position={{
											lat: result.lat,
											lng: result.lng,
										}}
										icon={buildResolvedStationMarkerIcon(
											window.google.maps,
											{
												name: result.name,
												stationBrandLogoId: null,
											},
											stationBrandLogos,
											{ isSelected },
										)}
										onClick={() =>
											handleSelectResult(result)
										}
										zIndex={isSelected ? 10_000 : 5_000}
									/>
								);
							})}

							{selectedResult ? (
								<InfoWindowF
									position={{
										lat: selectedResult.lat,
										lng: selectedResult.lng,
									}}
									onCloseClick={() =>
										setSelectedResultId(null)
									}
								>
									<div className="max-w-xs">
										<p className="font-semibold text-foreground dark:text-black">
											{selectedResult.name}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{selectedResult.address}
										</p>
										{isResolvingSelectedResultAddress ? (
											<p className="mt-1 text-[11px] text-muted-foreground">
												Resolving address...
											</p>
										) : null}
										<div className="mt-3">
											<Button
												type="button"
												size="sm"
												onClick={() =>
													handleSelectResult(
														selectedResult,
													)
												}
											>
												Use this station
											</Button>
										</div>
									</div>
								</InfoWindowF>
							) : null}
						</GoogleMap>
					</div>
				</div>

				<div className="rounded-2xl bg-card p-5 shadow-sovereign overflow-auto max-h-[646px]">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<h3 className="text-xl font-semibold text-foreground">
								Discovery Results
							</h3>
							<p className="text-sm text-muted-foreground">
								Select one result to prefill the local station
								create form.
							</p>
						</div>
						<div className="flex items-center gap-2">
							{results.length > 0 ? (
								<span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
									{results.length} found
								</span>
							) : null}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={autoDetectAllResultScopes}
								disabled={
									results.length === 0 ||
									isAutoDetectingScopes
								}
							>
								{isAutoDetectingScopes ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Auto detecting
									</>
								) : (
									<>
										<Crosshair className="h-4 w-4" />
										Auto Detect
									</>
								)}
							</Button>
						</div>
					</div>

					<div className="mb-4 grid gap-3 md:grid-cols-2">
						<SearchableResultsScopeSelect
							label="Province"
							placeholder="Set province for results"
							searchPlaceholder="Search provinces..."
							emptyLabel="No provinces found."
							options={provinces.map((province) => ({
								code: province.code,
								name: province.name,
							}))}
							value={resultsProvinceFilter}
							onChange={handleResultsProvinceFilterChange}
						/>
						<SearchableResultsScopeSelect
							label="City / Municipality"
							placeholder={
								resultsProvinceFilter
									? "Set city or municipality"
									: "Select a province first"
							}
							searchPlaceholder="Search cities or municipalities..."
							emptyLabel={
								resultsProvinceFilter
									? "No cities or municipalities found."
									: "Select a province first."
							}
							options={filteredCities.map((city) => ({
								code: city.code,
								name: city.name,
							}))}
							value={resultsCityFilter}
							disabled={!resultsProvinceFilter}
							onChange={handleResultsCityFilterChange}
						/>
					</div>

					{searchError ? (
						<div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
							{searchError}
						</div>
					) : null}

					{results.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
							Move the map, then click{" "}
							<span className="font-medium text-foreground">
								Search this area
							</span>{" "}
							to load discovered fuel stations.
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<div className="rounded-xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
								<span className="font-medium text-foreground">
									Auto Create summary:
								</span>{" "}
								{autoCreateSummary.eligible} eligible,{" "}
								{autoCreateSummary.unsupported_brand}{" "}
								unsupported , {autoCreateSummary.duplicate}{" "}
								duplicate, {autoCreateSummary.missing_scope}{" "}
								missing scope.
							</div>
							{results.map((result) => {
								const duplicateMatch =
									duplicateMatches.get(result.externalId) ??
									null;
								const isSelected =
									result.externalId === selectedResultId;
								const assessment = resultAssessments.get(
									result.externalId,
								) ?? {
									duplicateMatch: null,
									detectedScope: null,
									matchedBrand: null,
									status: "unsupported_brand" as const,
								};

								return (
									<div
										key={result.externalId}
										onClick={() =>
											handleSelectResult(result)
										}
										role="button"
										tabIndex={0}
										onKeyDown={(event) => {
											if (
												event.key === "Enter" ||
												event.key === " "
											) {
												event.preventDefault();
												handleSelectResult(result);
											}
										}}
										className={`rounded-xl border p-4 text-left transition-colors ${
											isSelected
												? "border-primary bg-primary/5"
												: "border-border bg-secondary/30 hover:bg-secondary/50"
										}`}
									>
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div className="min-w-0 flex-1">
												<p className="font-semibold text-foreground">
													{result.name}
												</p>
												<p className="mt-1 text-sm text-muted-foreground">
													{result.address}
												</p>
												{isSelected &&
												isResolvingSelectedResultAddress ? (
													<p className="mt-1 text-[11px] text-muted-foreground">
														Resolving address...
													</p>
												) : null}
												<p className="mt-2 text-xs text-muted-foreground">
													{formatLatLng(result.lat)},{" "}
													{formatLatLng(result.lng)}
												</p>
											</div>
											<div className="flex flex-col items-end gap-2">
												{duplicateMatch ? (
													<span className="inline-flex rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
														{getDuplicateLabel(
															duplicateMatch,
														)}
													</span>
												) : (
													<span className="inline-flex rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
														New Candidate
													</span>
												)}
												<span
													className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getAssessmentTone(
														assessment,
													)}`}
												>
													{getAssessmentLabel(
														assessment,
													)}
												</span>
												<span className="text-xs text-muted-foreground">
													Click to prefill
												</span>
											</div>
										</div>
										<p className="mt-3 text-xs text-muted-foreground">
											{getAssessmentMessage(assessment)}
										</p>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>

			<div className="min-h-0">
				{selectedResult ? (
					isPrefilling ? (
						<div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-card p-6 shadow-sovereign">
							<div className="flex items-center gap-3 text-sm text-muted-foreground">
								<Loader2 className="h-5 w-5 animate-spin" />
								Loading discovered station details...
							</div>
						</div>
					) : (
						<DiscoveryStationForm
							form={stationForm}
							provinces={provinces}
							visibleCities={visibleCities}
							isSaving={saveStation.isPending}
							duplicateMatch={selectedDuplicateMatch}
							onFormChange={setStationForm}
							onSubmit={() => saveStation.mutate()}
							onOpenExistingStation={openExistingStation}
						/>
					)
				) : (
					<div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl bg-card p-8 text-center shadow-sovereign">
						<div>
							<MapPinned className="mx-auto h-8 w-8 text-accent" />
							<p className="mt-3 font-medium text-foreground">
								Select a discovered station result
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								The create form will appear here once you choose
								a station from the map results.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default function AdminStationDiscoveryPage() {
	const location = useLocation();
	const { data: stations = [], isLoading } = useAdminStations();
	const initialGoogleStation = useMemo(() => {
		const state = location.state as {
			prefilledGoogleStation?: DiscoveredStation | null;
		} | null;
		const candidate = state?.prefilledGoogleStation;

		if (
			!candidate ||
			!candidate.externalId ||
			!candidate.name ||
			!Number.isFinite(candidate.lat) ||
			!Number.isFinite(candidate.lng)
		) {
			return null;
		}

		return candidate;
	}, [location.state]);

	if (!GOOGLE_MAPS_API_KEY) {
		return (
			<div className="rounded-2xl border border-border bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<MapPinned className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Google Maps is not configured
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Add `VITE_GOOGLE_MAPS_API_KEY` to your environment
							to enable Station Discovery.
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<LoadScriptNext
			id={GOOGLE_MAPS_SCRIPT_ID}
			googleMapsApiKey={GOOGLE_MAPS_API_KEY}
			libraries={GOOGLE_MAPS_LIBRARIES}
			loadingElement={
				<div className="flex min-h-[480px] items-center justify-center rounded-2xl bg-card shadow-sovereign">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			}
		>
			<GoogleDiscoveryMap
				stations={stations}
				initialGoogleStation={initialGoogleStation}
			/>
		</LoadScriptNext>
	);
}

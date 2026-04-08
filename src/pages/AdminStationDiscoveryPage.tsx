import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
} from "@react-google-maps/api";
import {
	AlertTriangle,
	ExternalLink,
	Loader2,
	MapPinned,
	Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { detectGeoScopeFromAddress } from "@/lib/geo-detection";
import { fuelTypes, stationStatuses } from "@/lib/fuel-prices";
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

type GoogleDiscoveredStation = {
	placeId: string;
	name: string;
	address: string;
	lat: number;
	lng: number;
	addressComponents?: google.maps.places.AddressComponent[];
};

type DuplicateMatch = {
	station: GasStationRow;
	kind: "exact_place_id" | "name_and_distance" | "distance_only";
	distanceMeters: number;
};

const DEFAULT_DISCOVERY_ZOOM = 15;
const SELECTED_RESULT_ZOOM = 17;
const NAME_AND_DISTANCE_DUPLICATE_THRESHOLD_METERS = 150;
const DISTANCE_ONLY_DUPLICATE_THRESHOLD_METERS = 30;

function normalizeText(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function toRadians(value: number) {
	return (value * Math.PI) / 180;
}

function calculateDistanceMeters(
	start: { lat: number; lng: number },
	end: { lat: number; lng: number },
) {
	const earthRadiusMeters = 6_371_000;
	const deltaLat = toRadians(end.lat - start.lat);
	const deltaLng = toRadians(end.lng - start.lng);
	const startLat = toRadians(start.lat);
	const endLat = toRadians(end.lat);

	const haversine =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

	return (
		2 *
		earthRadiusMeters *
		Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
	);
}

function dedupeDiscoveredStations(results: GoogleDiscoveredStation[]) {
	const deduped = new Map<string, GoogleDiscoveredStation>();

	for (const result of results) {
		deduped.set(result.placeId, result);
	}

	return Array.from(deduped.values());
}

function mapPlaceResult(
	result: google.maps.places.Place,
): GoogleDiscoveredStation | null {
	const placeId = result.id?.trim();
	const name = result.displayName?.trim();
	const location = result.location;

	if (!placeId || !name || !location) {
		return null;
	}

	return {
		placeId,
		name,
		address: result.formattedAddress?.trim() || "Address unavailable",
		lat: location.lat(),
		lng: location.lng(),
		addressComponents: result.addressComponents,
	};
}

function getDuplicateMatch(
	result: GoogleDiscoveredStation,
	stations: GasStationRow[],
): DuplicateMatch | null {
	const exactPlaceIdMatch =
		result.placeId &&
		stations.find(
			(station) =>
				station.google_place_id?.trim() &&
				station.google_place_id === result.placeId,
		);

	if (exactPlaceIdMatch) {
		return {
			station: exactPlaceIdMatch,
			kind: "exact_place_id",
			distanceMeters: calculateDistanceMeters(result, exactPlaceIdMatch),
		};
	}

	const normalizedResultName = normalizeText(result.name);
	const stationsByDistance = stations
		.map((station) => ({
			station,
			distanceMeters: calculateDistanceMeters(result, station),
			nameMatches:
				normalizedResultName.length > 0 &&
				normalizeText(station.name) === normalizedResultName,
		}))
		.sort((left, right) => left.distanceMeters - right.distanceMeters);

	const namedNearbyMatch = stationsByDistance.find(
		(candidate) =>
			candidate.nameMatches &&
			candidate.distanceMeters <=
				NAME_AND_DISTANCE_DUPLICATE_THRESHOLD_METERS,
	);

	if (namedNearbyMatch) {
		return {
			station: namedNearbyMatch.station,
			kind: "name_and_distance",
			distanceMeters: namedNearbyMatch.distanceMeters,
		};
	}

	const nearbyCoordinateMatch = stationsByDistance.find(
		(candidate) =>
			candidate.distanceMeters <=
			DISTANCE_ONLY_DUPLICATE_THRESHOLD_METERS,
	);

	if (nearbyCoordinateMatch) {
		return {
			station: nearbyCoordinateMatch.station,
			kind: "distance_only",
			distanceMeters: nearbyCoordinateMatch.distanceMeters,
		};
	}

	return null;
}

function getDuplicateLabel(match: DuplicateMatch) {
	if (match.kind === "exact_place_id") {
		return "Already Added";
	}

	if (match.kind === "name_and_distance") {
		return "Likely Duplicate";
	}

	return "Nearby Existing Station";
}

function getDuplicateMessage(match: DuplicateMatch) {
	if (match.kind === "exact_place_id") {
		return "This Google Maps station already exists in FuelWatch PH.";
	}

	if (match.kind === "name_and_distance") {
		return `A station with the same name already exists about ${Math.round(match.distanceMeters)}m away.`;
	}

	return `A local station already exists about ${Math.round(match.distanceMeters)}m from this Google result.`;
}

function formatLatLng(value: number) {
	return value.toFixed(6);
}

function buildAddressSearchText(result: GoogleDiscoveredStation) {
	const componentText = (result.addressComponents ?? [])
		.map((component) => component.longText?.trim())
		.filter(Boolean)
		.join(", ");

	return [result.address, componentText].filter(Boolean).join(", ");
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
	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						Create Station
					</h3>
					<p className="text-sm text-muted-foreground">
						Google Maps prefills the station details. Complete the
						local fuel data before saving.
					</p>
				</div>
				{form.googlePlaceId ? (
					<span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
						Place ID linked
					</span>
				) : null}
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
						{form.googlePlaceId || "Not linked"}
					</p>
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
								<select
									value={form.fuelAvailability[fuelType]}
									onChange={(event) =>
										onFormChange((current) => ({
											...current,
											prices:
												event.target.value === "Out"
													? {
															...current.prices,
															[fuelType]: "",
														}
													: current.prices,
											fuelAvailability: {
												...current.fuelAvailability,
												[fuelType]: event.target
													.value as
													| ""
													| "Available"
													| "Low"
													| "Out",
											},
										}))
									}
									className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
								>
									<option value="">No data</option>
									{stationStatuses.map((status) => (
										<option key={status} value={status}>
											{status}
										</option>
									))}
								</select>
							</div>
						))}
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						Optional for station discovery. Add prices only when you
						already have verified fuel data.
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

function GoogleDiscoveryMap({ stations }: { stations: GasStationRow[] }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { accessLevel } = useUserAccess();
	const { coordinates: currentLocation } = useCurrentLocation();
	const { provinces, cities, citiesByProvince } = useGeoReferences();
	const [map, setMap] = useState<google.maps.Map | null>(null);
	const [placesReady, setPlacesReady] = useState(false);
	const [results, setResults] = useState<GoogleDiscoveredStation[]>([]);
	const [selectedResultId, setSelectedResultId] = useState<string | null>(
		null,
	);
	const [stationForm, setStationForm] =
		useState<StationFormState>(initialStationForm);
	const [isSearching, setIsSearching] = useState(false);
	const [isPrefilling, setIsPrefilling] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);

	const mapCenter = currentLocation ?? MANILA_CENTER;

	const duplicateMatches = useMemo(() => {
		return new Map(
			results.map((result) => [
				result.placeId,
				getDuplicateMatch(result, stations),
			]),
		);
	}, [results, stations]);

	const selectedResult = selectedResultId
		? (results.find((result) => result.placeId === selectedResultId) ??
			null)
		: null;
	const selectedDuplicateMatch = selectedResultId
		? (duplicateMatches.get(selectedResultId) ?? null)
		: null;
	const visibleCities = stationForm.provinceCode
		? (citiesByProvince.get(stationForm.provinceCode) ?? [])
		: [];

	const saveStation = useMutation({
		mutationFn: async () => {
			const payload = {
				...buildStationPayload(stationForm, null, {
					allowEmptyPricing: true,
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
			toast.success("Station created from Google Maps");
			setSelectedResultId(null);
			setStationForm(initialStationForm);
		},
		onError: (error) => toast.error(error.message),
	});

	const searchCurrentArea = useCallback(async () => {
		if (!map || !placesReady) {
			setSearchError(
				"Google Places is not ready yet. Refresh the page once if this tab loaded Google Maps before Station Discovery.",
			);
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
			const { Place, SearchByTextRankPreference } =
				(await google.maps.importLibrary(
					"places",
				)) as google.maps.PlacesLibrary;
			const response = await Place.searchByText({
				textQuery: "gas station",
				fields: [
					"id",
					"displayName",
					"formattedAddress",
					"location",
					"viewport",
					"addressComponents",
				],
				locationRestriction: bounds,
				includedType: "gas_station",
				maxResultCount: 20,
				rankPreference: SearchByTextRankPreference.RELEVANCE,
				useStrictTypeFiltering: true,
			});

			const normalizedResults = dedupeDiscoveredStations(
				(response.places ?? [])
					.map(mapPlaceResult)
					.filter((result): result is GoogleDiscoveredStation =>
						Boolean(result),
					),
			);

			setResults(normalizedResults);
			setSearchError(
				normalizedResults.length === 0
					? "No Google fuel stations were found in the current map area."
					: null,
			);
		} catch (error) {
			setResults([]);
			setSearchError(
				error instanceof Error
					? error.message
					: "Google Maps could not load stations for this area right now.",
			);
		} finally {
			setIsSearching(false);
		}
	}, [map, placesReady]);

	const handleSelectResult = useCallback(
		(result: GoogleDiscoveredStation) => {
			setSelectedResultId(result.placeId);
			if (map) {
				map.panTo({ lat: result.lat, lng: result.lng });
				map.setZoom(SELECTED_RESULT_ZOOM);
			}

			setIsPrefilling(true);
			try {
				const detectedScope = detectGeoScopeFromAddress({
					address: buildAddressSearchText(result),
					provinces,
					cities,
				});

				setStationForm({
					...initialStationForm,
					name: result.name,
					address: result.address,
					lat: formatLatLng(result.lat),
					lng: formatLatLng(result.lng),
					googlePlaceId: result.placeId,
					provinceCode: detectedScope?.provinceCode ?? "",
					cityMunicipalityCode:
						detectedScope?.cityMunicipalityCode ?? "",
				});
			} finally {
				setIsPrefilling(false);
			}
		},
		[cities, map, provinces],
	);

	const openExistingStation = useCallback(
		(stationId: string) => {
			navigate(`/admin/stations?edit=${stationId}`);
		},
		[navigate],
	);

	useEffect(() => {
		if (!selectedResultId) {
			return;
		}

		const selectedStillExists = results.some(
			(result) => result.placeId === selectedResultId,
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
								Google Station Discovery
							</h3>
							<p className="text-sm text-muted-foreground">
								Move the map to the area you want, then search
								Google Maps for fuel stations inside the current
								view.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								onClick={searchCurrentArea}
								disabled={isSearching || !placesReady}
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
								const placeClass =
									window.google?.maps?.places?.Place;

								if (placeClass) {
									setPlacesReady(true);
									setSearchError(null);
								} else {
									setPlacesReady(false);
									setSearchError(
										"Google Places (New) did not finish loading in this browser tab. Refresh the page once, then try again.",
									);
								}
							}}
							onUnmount={() => {
								setMap(null);
								setPlacesReady(false);
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
									result.placeId === selectedResultId;
								return (
									<MarkerF
										key={result.placeId}
										position={{
											lat: result.lat,
											lng: result.lng,
										}}
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
								Google Results
							</h3>
							<p className="text-sm text-muted-foreground">
								Select one result to prefill the local station
								create form.
							</p>
						</div>
						{results.length > 0 ? (
							<span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
								{results.length} found
							</span>
						) : null}
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
							to load fuel stations from Google Maps.
						</div>
					) : (
						<div className="flex flex-col gap-3">
							{results.map((result) => {
								const duplicateMatch =
									duplicateMatches.get(result.placeId) ??
									null;
								const isSelected =
									result.placeId === selectedResultId;

								return (
									<button
										key={result.placeId}
										type="button"
										onClick={() =>
											handleSelectResult(result)
										}
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
												<span className="text-xs text-muted-foreground">
													Click to prefill
												</span>
											</div>
										</div>
									</button>
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
								Loading Google place details...
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
								Select a Google station result
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
	const { data: stations = [], isLoading } = useAdminStations();

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
			<GoogleDiscoveryMap stations={stations} />
		</LoadScriptNext>
	);
}

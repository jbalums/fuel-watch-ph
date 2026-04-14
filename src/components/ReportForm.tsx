import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { motion } from "framer-motion";
import {
	CheckCircle,
	ChevronDown,
	ChevronUp,
	ImagePlus,
	Loader2,
	MapPinned,
	Send,
	X,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/app-toast";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useStations } from "@/hooks/useStations";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import {
	FUEL_REPORT_FILE_INPUT_ACCEPT,
	removeFuelReportPhoto,
	uploadFuelReportPhoto,
	validateFuelReportPhoto,
} from "@/lib/fuel-report-photo-upload";
import { detectGeoScopeFromAddress } from "@/lib/geo-detection";
import { reverseGeocodeCoordinatesWithNominatim } from "@/lib/nominatim";
import { ReportLocationPicker } from "@/components/ReportLocationPicker";
import {
	createEmptyFuelAvailabilityFormMap,
	createEmptyFuelPriceFormMap,
	getFuelSummarySelection,
	hasAnyFuelAvailability,
	parseFuelAvailabilityForm,
	parseFuelPriceForm,
	stationStatuses,
	validateFuelPriceAvailability,
	fuelTypes,
	type FuelAvailabilityFormMap,
	type FuelPriceFormMap,
} from "@/lib/fuel-prices";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import type { FuelReportSubmissionMode, GasStation } from "@/types/station";
import type { DiscoveredStation } from "@/lib/station-discovery";

type UploadedPhoto = {
	path: string;
	filename: string;
};

function normalizeSearchValue(value: string) {
	return value.trim().toLowerCase();
}

function getStationDistanceScore(
	station: GasStation,
	coordinates: { lat: number; lng: number } | null,
) {
	if (!coordinates) {
		return Number.POSITIVE_INFINITY;
	}

	return (
		Math.abs(station.lat - coordinates.lat) +
		Math.abs(station.lng - coordinates.lng)
	);
}

function scoreStationMatch(station: GasStation, query: string) {
	if (!query) {
		return 0;
	}

	const haystack = [
		station.name,
		station.address,
		station.provinceCode ?? "",
		station.cityMunicipalityCode ?? "",
	]
		.join(" ")
		.toLowerCase();

	if (!haystack.includes(query)) {
		return Number.POSITIVE_INFINITY;
	}

	if (station.name.toLowerCase() === query) {
		return 0;
	}

	if (station.name.toLowerCase().startsWith(query)) {
		return 1;
	}

	if (station.address.toLowerCase().includes(query)) {
		return 3;
	}

	return 2;
}

function StationSearchField({
	value,
	selectedStation,
	suggestions,
	locationFiltersOpen,
	filterProvinceCode,
	filterCityMunicipalityCode,
	provinces,
	availableCities,
	onValueChange,
	onSelectStation,
	onToggleLocationFilters,
	onFilterProvinceChange,
	onFilterCityChange,
}: {
	value: string;
	selectedStation: GasStation | null;
	suggestions: GasStation[];
	locationFiltersOpen: boolean;
	filterProvinceCode: string;
	filterCityMunicipalityCode: string;
	provinces: ReturnType<typeof useGeoReferences>["provinces"];
	availableCities: ReturnType<typeof useGeoReferences>["cities"];
	onValueChange: (value: string) => void;
	onSelectStation: (station: GasStation) => void;
	onToggleLocationFilters: () => void;
	onFilterProvinceChange: (provinceCode: string) => void;
	onFilterCityChange: (cityCode: string) => void;
}) {
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	const handleSearchBlur = (event: FocusEvent<HTMLDivElement>) => {
		const nextFocusedElement = event.relatedTarget;
		if (
			nextFocusedElement &&
			event.currentTarget.contains(nextFocusedElement)
		) {
			return;
		}

		setIsSearchFocused(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<label className="text-label text-muted-foreground">
					Station Name
				</label>
				<Button
					type="button"
					variant="outline"
					onClick={onToggleLocationFilters}
					className="h-auto rounded-full px-3 py-1.5 text-xs font-medium"
				>
					<MapPinned className="h-3.5 w-3.5" />
					Filter location
					{locationFiltersOpen ? (
						<ChevronUp className="h-3.5 w-3.5" />
					) : (
						<ChevronDown className="h-3.5 w-3.5" />
					)}
				</Button>
			</div>

			{locationFiltersOpen ? (
				<div className="rounded border border-border bg-background p-4">
					<GeoScopeFields
						provinces={provinces}
						cities={availableCities}
						provinceCode={filterProvinceCode}
						cityMunicipalityCode={filterCityMunicipalityCode}
						provincePlaceholder="All Provinces"
						cityPlaceholder="All Cities / Municipalities"
						cityRequired={false}
						onProvinceChange={onFilterProvinceChange}
						onCityChange={onFilterCityChange}
					/>
				</div>
			) : null}

			<div
				className="rounded-md border border-border bg-foreground/50 backdrop-blur-lg"
				onBlur={handleSearchBlur}
			>
				<Command
					shouldFilter={false}
					className="relative overflow-visible"
				>
					<CommandInput
						value={value}
						onValueChange={onValueChange}
						onFocus={() => setIsSearchFocused(true)}
						placeholder="Search nearby or type a station name"
						className="h-12"
					/>
					{isSearchFocused && value.trim() ? (
						<CommandList className="absolute w-full top-[52px] h-56 z-20 bg-white/80 dark:bg-background border rounded-md shadow-sm">
							<>
								<CommandEmpty>
									No matching stations found. You can still
									submit a new station name.
								</CommandEmpty>
								{suggestions.map((station) => (
									<CommandItem
										key={station.id}
										value={`${station.name} ${station.address}`}
										onSelect={() => {
											onSelectStation(station);
											setIsSearchFocused(false);
										}}
										className="flex flex-col items-start gap-1 py-3"
									>
										<span className="font-bold">
											{station.name}
										</span>
										<span className="text-xs">
											{station.address}
										</span>
									</CommandItem>
								))}
							</>
						</CommandList>
					) : null}
				</Command>
			</div>

			<p className="text-xs text-muted-foreground">
				{selectedStation
					? "Selected station is linked to your report and also highlighted on the map."
					: "Suggestions appear after you start typing and are prioritized by nearby stations when location is available."}
			</p>
		</div>
	);
}

export function ReportForm() {
	const location = useLocation();
	const { user } = useAuth();
	const { data: stations = [] } = useStations();
	const { coordinates: currentLocation } = useCurrentLocation();
	const [provinceCode, setProvinceCode] = useState("");
	const { provinces, cities, citiesByProvince } = useGeoReferences({
		provinceCode,
		includeAllCities: false,
	});
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [submissionMode, setSubmissionMode] =
		useState<FuelReportSubmissionMode>("easy");
	const [stationName, setStationName] = useState("");
	const [prices, setPrices] = useState<FuelPriceFormMap>(
		createEmptyFuelPriceFormMap(),
	);
	const [fuelAvailability, setFuelAvailability] =
		useState<FuelAvailabilityFormMap>(createEmptyFuelAvailabilityFormMap());
	const [selectedStationId, setSelectedStationId] = useState<string | null>(
		null,
	);
	const [cityMunicipalityCode, setCityMunicipalityCode] = useState("");
	const [reportedAddress, setReportedAddress] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
		null,
	);
	const [submitting, setSubmitting] = useState(false);
	const [photoFile, setPhotoFile] = useState<File | null>(null);
	const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
	const [uploadedPhoto, setUploadedPhoto] = useState<UploadedPhoto | null>(
		null,
	);
	const [uploadingPhoto, setUploadingPhoto] = useState(false);
	const [photoUploadError, setPhotoUploadError] = useState<string | null>(
		null,
	);
	const [autoDetectScopeMessage, setAutoDetectScopeMessage] = useState<
		string | null
	>(null);
	const [standardAutoDetectScopeMessage, setStandardAutoDetectScopeMessage] =
		useState<string | null>(null);
	const hasManualScopeOverrideRef = useRef(false);
	const [stationSearchProvinceCode, setStationSearchProvinceCode] =
		useState("");
	const [
		stationSearchCityMunicipalityCode,
		setStationSearchCityMunicipalityCode,
	] = useState("");
	const [stationSearchFiltersOpen, setStationSearchFiltersOpen] =
		useState(false);
	const [prefilledGoogleStation, setPrefilledGoogleStation] =
		useState<DiscoveredStation | null>(() => {
			const state = location.state as {
				prefilledGoogleStation?: DiscoveredStation | null;
				prefilledStationId?: string | null;
				prefilledSubmissionMode?: FuelReportSubmissionMode | null;
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
		});
	const [prefilledStationId] = useState<string | null>(() => {
		const state = location.state as {
			prefilledStationId?: string | null;
		} | null;
		const candidate = state?.prefilledStationId;

		return typeof candidate === "string" && candidate.trim()
			? candidate
			: null;
	});
	const [prefilledSubmissionMode] = useState<FuelReportSubmissionMode | null>(
		() => {
			const state = location.state as {
				prefilledSubmissionMode?: FuelReportSubmissionMode | null;
			} | null;
			return state?.prefilledSubmissionMode === "standard" ||
				state?.prefilledSubmissionMode === "easy"
				? state.prefilledSubmissionMode
				: null;
		},
	);

	useEffect(() => {
		if (!photoFile) {
			setPhotoPreviewUrl(null);
			return;
		}

		const objectUrl = URL.createObjectURL(photoFile);
		setPhotoPreviewUrl(objectUrl);

		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [photoFile]);

	const resetPhotoState = () => {
		setPhotoFile(null);
		setPhotoPreviewUrl(null);
		setUploadedPhoto(null);
		setUploadingPhoto(false);
		setPhotoUploadError(null);

		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const clearReportForm = () => {
		hasManualScopeOverrideRef.current = false;
		setStationName("");
		setPrices(createEmptyFuelPriceFormMap());
		setFuelAvailability(createEmptyFuelAvailabilityFormMap());
		setSelectedStationId(null);
		setProvinceCode("");
		setCityMunicipalityCode("");
		setReportedAddress(null);
		setCoords(null);
		resetPhotoState();
	};

	useEffect(() => {
		if (!prefilledGoogleStation) {
			return;
		}

		setStationName(prefilledGoogleStation.name);
		setReportedAddress(prefilledGoogleStation.address);
		setCoords({
			lat: prefilledGoogleStation.lat,
			lng: prefilledGoogleStation.lng,
		});
		setSelectedStationId(null);
		setSubmissionMode("easy");
	}, [prefilledGoogleStation]);

	useEffect(() => {
		if (!prefilledStationId) {
			return;
		}

		const prefilledStation =
			stations.find((station) => station.id === prefilledStationId) ??
			null;

		if (!prefilledStation) {
			return;
		}

		setPrefilledGoogleStation(null);
		setSubmissionMode(prefilledSubmissionMode ?? "standard");
		setSelectedStationId(prefilledStation.id);
		setStationName(prefilledStation.name);
		setReportedAddress(prefilledStation.address);
		setCoords({
			lat: prefilledStation.lat,
			lng: prefilledStation.lng,
		});
		setProvinceCode(prefilledStation.provinceCode ?? "");
		setCityMunicipalityCode(prefilledStation.cityMunicipalityCode ?? "");
	}, [prefilledStationId, prefilledSubmissionMode, stations]);

	const selectedStation = selectedStationId
		? (stations.find((station) => station.id === selectedStationId) ?? null)
		: null;
	const isEasyReport = submissionMode === "easy";
	const selectedStationHasScope = Boolean(
		!isEasyReport &&
		selectedStation?.provinceCode &&
		selectedStation?.cityMunicipalityCode,
	);
	const availableCities = provinceCode
		? (citiesByProvince.get(provinceCode) ?? [])
		: [];
	const stationSearchCities = stationSearchProvinceCode
		? (citiesByProvince.get(stationSearchProvinceCode) ?? [])
		: [];
	const filteredStationSuggestions = useMemo(() => {
		const normalizedQuery = normalizeSearchValue(stationName);
		const candidates = stations.filter((station) => {
			if (
				stationSearchProvinceCode &&
				station.provinceCode !== stationSearchProvinceCode
			) {
				return false;
			}

			if (
				stationSearchCityMunicipalityCode &&
				station.cityMunicipalityCode !==
					stationSearchCityMunicipalityCode
			) {
				return false;
			}

			if (!normalizedQuery) {
				return true;
			}

			return (
				station.name.toLowerCase().includes(normalizedQuery) ||
				station.address.toLowerCase().includes(normalizedQuery)
			);
		});

		return [...candidates]
			.sort((left, right) => {
				const matchDelta =
					scoreStationMatch(left, normalizedQuery) -
					scoreStationMatch(right, normalizedQuery);
				if (matchDelta !== 0) {
					return matchDelta;
				}

				const distanceDelta =
					getStationDistanceScore(left, currentLocation) -
					getStationDistanceScore(right, currentLocation);
				if (
					normalizedQuery ||
					(Number.isFinite(distanceDelta) && distanceDelta !== 0)
				) {
					return distanceDelta;
				}

				return left.name.localeCompare(right.name);
			})
			.slice(0, normalizedQuery ? 8 : currentLocation ? 8 : 6);
	}, [
		currentLocation,
		stationName,
		stationSearchCityMunicipalityCode,
		stationSearchProvinceCode,
		stations,
	]);

	const uploadSelectedPhoto = async (file: File) => {
		if (!user) {
			throw new Error("Please sign in before uploading a report photo");
		}

		const validationError = validateFuelReportPhoto(file);
		if (validationError) {
			throw new Error(validationError);
		}

		if (uploadedPhoto?.path) {
			await removeFuelReportPhoto(uploadedPhoto.path).catch(
				() => undefined,
			);
		}

		setUploadingPhoto(true);
		setPhotoUploadError(null);

		try {
			const uploaded = await uploadFuelReportPhoto({
				file,
				userId: user.id,
			});

			setUploadedPhoto(uploaded);
			return uploaded;
		} finally {
			setUploadingPhoto(false);
		}
	};

	const handlePhotoChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0] ?? null;
		if (!file) {
			return;
		}

		const validationError = validateFuelReportPhoto(file);
		if (validationError) {
			setPhotoFile(null);
			setUploadedPhoto(null);
			setPhotoUploadError(validationError);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}

		setPhotoFile(file);

		try {
			await uploadSelectedPhoto(file);
		} catch (error) {
			setUploadedPhoto(null);
			setPhotoUploadError(
				error instanceof Error
					? error.message
					: "Failed to upload photo",
			);
		}
	};

	const handleRemovePhoto = async () => {
		if (uploadedPhoto?.path) {
			await removeFuelReportPhoto(uploadedPhoto.path).catch((error) => {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to remove uploaded photo",
				);
			});
		}

		resetPhotoState();
	};

	useEffect(() => {
		if (!isEasyReport || !reportedAddress?.trim()) {
			setAutoDetectScopeMessage(null);
			return;
		}

		const detectedScope = detectGeoScopeFromAddress({
			address: reportedAddress,
			provinces,
			cities,
		});

		if (!detectedScope) {
			setAutoDetectScopeMessage(
				"We couldn't auto-detect the province and city from this address yet.",
			);
			return;
		}

		const nextProvinceCode = detectedScope.provinceCode ?? "";
		const nextCityMunicipalityCode =
			detectedScope.cityMunicipalityCode ?? "";

		if (
			provinceCode !== nextProvinceCode ||
			cityMunicipalityCode !== nextCityMunicipalityCode
		) {
			setProvinceCode(nextProvinceCode);
			setCityMunicipalityCode(nextCityMunicipalityCode);
		}

		setAutoDetectScopeMessage(
			nextCityMunicipalityCode
				? "Province and city were auto-detected from the pinned location."
				: "Province was auto-detected from the pinned location.",
		);
	}, [
		cities,
		cityMunicipalityCode,
		isEasyReport,
		provinceCode,
		provinces,
		reportedAddress,
	]);

	useEffect(() => {
		if (
			isEasyReport ||
			selectedStationId ||
			hasManualScopeOverrideRef.current ||
			!currentLocation ||
			provinces.length === 0 ||
			cities.length === 0 ||
			(provinceCode.trim() && cityMunicipalityCode.trim())
		) {
			if (isEasyReport || selectedStationId) {
				setStandardAutoDetectScopeMessage(null);
			}
			return;
		}

		let isCancelled = false;

		const autoDetectStandardScope = async () => {
			setStandardAutoDetectScopeMessage(
				"Detecting province and city from your current location...",
			);

			try {
				const result =
					await reverseGeocodeCoordinatesWithNominatim(
						currentLocation,
					);

				if (isCancelled) {
					return;
				}

				const detectedScope = detectGeoScopeFromAddress({
					address: result.addressText,
					provinces,
					cities,
				});

				if (!detectedScope?.provinceCode) {
					setStandardAutoDetectScopeMessage(
						"We couldn't auto-detect your report scope yet. Please choose the province and city manually.",
					);
					return;
				}

				const nextProvinceCode = detectedScope.provinceCode ?? "";
				const nextCityMunicipalityCode =
					detectedScope.cityMunicipalityCode ?? "";

				if (provinceCode !== nextProvinceCode) {
					setProvinceCode(nextProvinceCode);
				}

				if (cityMunicipalityCode !== nextCityMunicipalityCode) {
					setCityMunicipalityCode(nextCityMunicipalityCode);
				}

				setStandardAutoDetectScopeMessage(
					nextCityMunicipalityCode
						? "Province and city were auto-detected from your current location."
						: "Province was auto-detected from your current location. Please choose the city or municipality if needed.",
				);
			} catch (error) {
				if (isCancelled) {
					return;
				}

				console.error(
					"Failed to auto-detect Standard Report scope",
					error,
				);
				setStandardAutoDetectScopeMessage(
					"Auto-detect is unavailable right now. Please choose the province and city manually.",
				);
			}
		};

		void autoDetectStandardScope();

		return () => {
			isCancelled = true;
		};
	}, [
		cities,
		cityMunicipalityCode,
		currentLocation,
		isEasyReport,
		provinceCode,
		provinces,
		selectedStationId,
	]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		if (!coords) {
			toast.error("Pick a location from the map");
			return;
		}

		if (!isEasyReport && !stationName.trim()) {
			toast.error("Station name is required");
			return;
		}

		if (!isEasyReport && !provinceCode.trim()) {
			toast.error("Select the report province");
			return;
		}

		if (!isEasyReport && !cityMunicipalityCode.trim()) {
			toast.error("Select the report city or municipality");
			return;
		}

		let normalizedPrices = null;
		let normalizedAvailability = null;
		let summarySelection = null;

		if (!isEasyReport) {
			try {
				normalizedPrices = parseFuelPriceForm(prices);
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Invalid fuel price",
				);
				return;
			}

			try {
				normalizedAvailability =
					parseFuelAvailabilityForm(fuelAvailability);
				validateFuelPriceAvailability(
					normalizedPrices,
					normalizedAvailability,
				);
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Invalid fuel availability",
				);
				return;
			}

			summarySelection = getFuelSummarySelection(
				normalizedPrices,
				normalizedAvailability,
				selectedStation?.fuelType,
			);

			if (
				!summarySelection ||
				!hasAnyFuelAvailability(normalizedAvailability)
			) {
				toast.error("Add at least one fuel availability or price");
				return;
			}
		}

		setSubmitting(true);
		let photoAttachment = uploadedPhoto;

		if (photoFile && !photoAttachment) {
			try {
				photoAttachment = await uploadSelectedPhoto(photoFile);
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to upload photo",
				);
				setSubmitting(false);
				return;
			}
		}

		if (isEasyReport && !photoAttachment) {
			toast.error("Upload a fuel price photo for Easy Report");
			setSubmitting(false);
			return;
		}

		const { error } = await supabase.from("fuel_reports").insert({
			user_id: user.id,
			submission_mode: submissionMode,
			station_name: stationName.trim() || null,
			price: isEasyReport ? null : summarySelection!.price,
			fuel_type: isEasyReport ? null : summarySelection!.fuelType,
			prices: isEasyReport
				? {
						Unleaded: null,
						Premium: null,
						Diesel: null,
						"Premium Diesel": null,
						Kerosene: null,
					}
				: normalizedPrices,
			fuel_availability: isEasyReport
				? {
						Unleaded: null,
						Premium: null,
						Diesel: null,
						"Premium Diesel": null,
					}
				: normalizedAvailability,
			status: isEasyReport ? null : summarySelection!.status,
			station_id: isEasyReport ? null : selectedStationId,
			province_code: provinceCode.trim() || null,
			city_municipality_code: cityMunicipalityCode.trim() || null,
			reported_address:
				reportedAddress ??
				`Pinned location (${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})`,
			lat: coords.lat,
			lng: coords.lng,
			photo_path: photoAttachment?.path ?? null,
			photo_filename: photoAttachment?.filename ?? null,
		});

		if (error) {
			if (photoAttachment?.path) {
				await removeFuelReportPhoto(photoAttachment.path).catch(
					() => undefined,
				);
				setUploadedPhoto(null);
			}
			toast.error("Failed to submit report");
			setSubmitting(false);
			return;
		}

		setSubmitted(true);
		setSubmitting(false);
		setTimeout(() => {
			setSubmitted(false);
			clearReportForm();
		}, 2500);
	};

	if (submitted) {
		return (
			<motion.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-card p-10 text-center shadow-sovereign"
			>
				<CheckCircle className="h-12 w-12 text-success" />
				<h2 className="text-headline text-foreground">
					Report Submitted
				</h2>
				<p className="text-sm text-muted-foreground">
					{isEasyReport
						? "Your photo-first report is now pending manual review."
						: "Thank you for helping fellow motorists!"}
				</p>
			</motion.div>
		);
	}

	return (
		<motion.form
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ ease: [0.2, 0.8, 0.2, 1] }}
			onSubmit={handleSubmit}
			className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-sovereign"
		>
			<h2 className="text-headline text-foreground">Report Fuel Price</h2>

			<div className="grid gap-3 md:grid-cols-2">
				<button
					type="button"
					onClick={() => setSubmissionMode("easy")}
					className={`!rounded-sm border px-4 py-4 text-left transition-colors ${
						submissionMode === "easy"
							? "border-amber-600 bg-amber-600/5"
							: "border-border bg-background hover:bg-secondary/40"
					}`}
				>
					<p className="text-sm font-semibold text-amber-600">
						Easy Report
					</p>
					<p className="mt-1 text-xs text-amber-900/70 dark:text-amber-700">
						Just upload a fuel-price photo, pin your location, and
						confirm the province and city. Admin or LGU reviewers
						will enter the prices manually.
					</p>
				</button>
				<button
					type="button"
					onClick={() => setSubmissionMode("standard")}
					className={`!rounded-sm border px-4 py-4 text-left transition-colors ${
						submissionMode === "standard"
							? "border-primary bg-primary/5"
							: "border-border bg-background hover:bg-secondary/40"
					}`}
				>
					<p className="text-sm font-semibold text-primary">
						Standard Report
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Enter the station name, fuel prices, and per-fuel
						availability yourself.
					</p>
				</button>
			</div>

			{!isEasyReport ? (
				<StationSearchField
					value={stationName}
					selectedStation={selectedStation}
					suggestions={filteredStationSuggestions}
					locationFiltersOpen={stationSearchFiltersOpen}
					filterProvinceCode={stationSearchProvinceCode}
					filterCityMunicipalityCode={
						stationSearchCityMunicipalityCode
					}
					provinces={provinces}
					availableCities={stationSearchCities}
					onValueChange={(value) => {
						setStationName(value);
						if (selectedStationId) {
							setSelectedStationId(null);
						}
					}}
					onSelectStation={(station) => {
						hasManualScopeOverrideRef.current = false;
						setSelectedStationId(station.id);
						setStationName(station.name);
						setReportedAddress(station.address);
						setProvinceCode(station.provinceCode ?? "");
						setCityMunicipalityCode(
							station.cityMunicipalityCode ?? "",
						);
						setCoords({
							lat: station.lat,
							lng: station.lng,
						});
					}}
					onToggleLocationFilters={() =>
						setStationSearchFiltersOpen((current) => !current)
					}
					onFilterProvinceChange={(nextProvinceCode) => {
						setStationSearchProvinceCode(nextProvinceCode);
						setStationSearchCityMunicipalityCode("");
					}}
					onFilterCityChange={setStationSearchCityMunicipalityCode}
				/>
			) : (
				<div className="">
					<p className="text-sm font-medium text-amber-600">
						Easy Report keeps this fast.
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Take a clear photo of the fuel price board or pump, pin
						where you are, and confirm the report scope. Admin or
						LGU officers will review the image and enter the prices
						manually.
					</p>
					{prefilledGoogleStation ? (
						<div className="mt-3 rounded-xl border border-amber-600/20 bg-amber-600/5 px-4 py-3 text-xs text-amber-900/80 dark:text-amber-700">
							<p className="font-medium text-amber-700 dark:text-amber-500">
								Reporting discovered station
							</p>
							<p className="mt-1">
								{prefilledGoogleStation.name}
							</p>
							<p className="mt-1">
								{prefilledGoogleStation.address}
							</p>
						</div>
					) : null}
				</div>
			)}

			{!isEasyReport ? (
				<div className="flex flex-col gap-1.5">
					<label className="text-label text-muted-foreground">
						Prices per Liter (₱)
					</label>
					<div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
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
									value={prices[fuelType]}
									onChange={(event) =>
										setPrices((current) => ({
											...current,
											[fuelType]: event.target.value,
										}))
									}
									placeholder="0.00"
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all tabular-nums"
								/>
								<select
									value={fuelAvailability[fuelType]}
									onChange={(event) => {
										const nextStatus = event.target
											.value as
											| ""
											| "Available"
											| "Low"
											| "Out";
										setFuelAvailability((current) => ({
											...current,
											[fuelType]: nextStatus,
										}));

										if (nextStatus === "Out") {
											setPrices((current) => ({
												...current,
												[fuelType]: "",
											}));
										}
									}}
									className="rounded-xl bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
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
					<p className="text-xs text-muted-foreground">
						Mark each reported fuel as Available, Low, or Out. Leave
						both fields blank when you have no data for that fuel.
					</p>
				</div>
			) : null}

			<div className="flex flex-col gap-1.5">
				<label className="text-label text-muted-foreground">
					Verification Photo
				</label>
				<div className="rounded-2xl border border-border bg-background p-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-medium text-foreground">
								Upload a pump, price board, or receipt photo
							</p>
							<p className="text-xs text-muted-foreground">
								{isEasyReport
									? "Required. Admin or LGU reviewers will use this image to complete the report."
									: "Optional. Used for admin verification of your report."}
							</p>
						</div>
						{photoFile ? (
							<button
								type="button"
								onClick={() => void handleRemovePhoto()}
								className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
							>
								<X className="h-3.5 w-3.5" />
								Remove
							</button>
						) : null}
					</div>

					<label className="mt-3 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-surface-alt px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
						<ImagePlus className="h-4 w-4 shrink-0" />
						<span className="min-w-0 flex-1 truncate">
							{photoFile
								? photoFile.name
								: "Choose JPG, JPEG, or PNG (max 10MB)"}
						</span>
						<span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground">
							{photoFile ? "Replace" : "Browse"}
						</span>
						<input
							ref={fileInputRef}
							type="file"
							accept={FUEL_REPORT_FILE_INPUT_ACCEPT}
							onChange={(event) => void handlePhotoChange(event)}
							className="hidden"
						/>
					</label>

					{photoPreviewUrl && (
						<div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-alt">
							<img
								src={photoPreviewUrl}
								alt={photoFile?.name || "Selected report photo"}
								className="h-44 w-full object-cover"
							/>
						</div>
					)}

					{photoFile && (
						<p className="mt-2 text-xs text-foreground">
							Selected file: {photoFile.name}
						</p>
					)}

					{uploadingPhoto && (
						<p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							Uploading verification photo...
						</p>
					)}

					{photoUploadError && (
						<p className="mt-2 text-xs text-destructive">
							{photoUploadError}
						</p>
					)}
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-label text-muted-foreground">
					{isEasyReport ? "Pin Current Location" : "Location"}
				</label>
				<ReportLocationPicker
					stations={stations}
					selectedStationId={selectedStationId}
					selectedPosition={coords}
					selectedAddress={reportedAddress}
					autoPinCurrentLocation={
						isEasyReport && !prefilledGoogleStation
					}
					allowExistingStationSelection
					onSelectExistingStation={(station) => {
						hasManualScopeOverrideRef.current = false;
						if (isEasyReport) {
							setPrefilledGoogleStation(null);
						}
						setSelectedStationId(station.id);
						setStationName(station.name);
						setReportedAddress(station.address);
						setProvinceCode(station.provinceCode ?? "");
						setCityMunicipalityCode(
							station.cityMunicipalityCode ?? "",
						);
						setCoords({
							lat: station.lat,
							lng: station.lng,
						});
					}}
					onSelectNewLocation={(selection) => {
						hasManualScopeOverrideRef.current = false;
						setCoords({
							lat: selection.lat,
							lng: selection.lng,
						});
						setReportedAddress(selection.reportedAddress);
						if (isEasyReport) {
							setPrefilledGoogleStation(null);
							setStationName("");
						}
						setSelectedStationId(null);
						if (!isEasyReport) {
							setStationName((current) =>
								selectedStationId ? "" : current,
							);
						}
					}}
					onClearSelection={() => {
						hasManualScopeOverrideRef.current = false;
						setCoords(null);
						setReportedAddress(null);
						setProvinceCode("");
						setCityMunicipalityCode("");
						if (isEasyReport) {
							setPrefilledGoogleStation(null);
							setStationName("");
						}
						if (!isEasyReport) {
							setStationName((current) =>
								selectedStationId ? "" : current,
							);
						}
						setSelectedStationId(null);
					}}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-label text-muted-foreground">
					Geographic Scope
				</label>
				<GeoScopeFields
					provinces={provinces}
					cities={availableCities}
					provinceCode={provinceCode}
					cityMunicipalityCode={cityMunicipalityCode}
					requestedRole={isEasyReport ? undefined : "city_admin"}
					provinceDisabled={selectedStationHasScope}
					cityDisabled={selectedStationHasScope}
					onProvinceChange={(nextProvinceCode) => {
						hasManualScopeOverrideRef.current = true;
						setProvinceCode(nextProvinceCode);
						setCityMunicipalityCode("");
					}}
					onCityChange={(nextCityMunicipalityCode) => {
						hasManualScopeOverrideRef.current = true;
						setCityMunicipalityCode(nextCityMunicipalityCode);
					}}
				/>
				<p className="text-xs text-muted-foreground">
					{isEasyReport
						? (autoDetectScopeMessage ??
							"Optional, but helpful for routing your report to the right LGU queue faster.")
						: selectedStationHasScope
							? "This scope is inherited from the selected station."
							: selectedStationId
								? "This station still needs a province and city assignment for approval."
								: (standardAutoDetectScopeMessage ??
									"Pick the province and city or municipality for this report.")}
				</p>
			</div>

			<motion.button
				whileTap={{ scale: 0.97 }}
				type="submit"
				disabled={submitting || uploadingPhoto}
				className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground sovereign-ease hover:bg-primary-hover transition-colors disabled:opacity-50"
			>
				{submitting || uploadingPhoto ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Send className="h-4 w-4" />
				)}
				{uploadingPhoto
					? "Uploading Photo..."
					: submitting
						? "Submitting..."
						: isEasyReport
							? "Submit Easy Report"
							: "Submit Report"}
			</motion.button>
		</motion.form>
	);
}

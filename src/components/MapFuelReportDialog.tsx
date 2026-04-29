import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type FormEvent,
} from "react";
import { ImagePlus, Loader2, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import type {
	GeoCityMunicipality,
	GeoProvince,
} from "@/hooks/useGeoReferences";
import { toast } from "@/lib/app-toast";
import {
	FUEL_REPORT_FILE_INPUT_ACCEPT,
	removeFuelReportPhoto,
	uploadFuelReportPhoto,
	validateFuelReportPhoto,
} from "@/lib/fuel-report-photo-upload";
import {
	createEmptyFuelAvailabilityFormMap,
	createEmptyFuelPriceFormMap,
	deriveFuelAvailabilityFromPrices,
	fuelTypes,
	fuelTypeTextColorClassNames,
	getFuelSummarySelection,
	hasAnyFuelAvailability,
	isFuelSellable,
	parseFuelAvailabilityForm,
	parseFuelPriceForm,
	validateFuelPriceAvailability,
	type FuelPriceFormMap,
} from "@/lib/fuel-prices";
import { supabase } from "@/integrations/supabase/client";
import type { DiscoveredStation } from "@/lib/station-discovery";
import type { FuelType, GasStation } from "@/types/station";

const EMPTY_SELECT_VALUE = "__none__";
type MapReportSubmissionMode = "standard" | "easy";

export type MapFuelReportTarget =
	| {
			type: "listed";
			station: GasStation;
	  }
	| {
			type: "discovered";
			station: DiscoveredStation;
			provinceCode?: string | null;
			cityMunicipalityCode?: string | null;
	  };

interface MapFuelReportDialogProps {
	open: boolean;
	target: MapFuelReportTarget | null;
	provinces: GeoProvince[];
	cities: GeoCityMunicipality[];
	onOpenChange: (open: boolean) => void;
	onSubmitted?: () => void;
}

function formatPrice(value: number | null | undefined) {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return null;
	}

	return `₱${value.toFixed(2)}`;
}

function getStationDisplayAddress(target: MapFuelReportTarget | null) {
	if (!target) {
		return "";
	}

	const address = target.station.address?.trim();
	if (address) {
		return address;
	}

	return `Pinned location (${target.station.lat.toFixed(6)}, ${target.station.lng.toFixed(6)})`;
}

function getInitialProvinceCode(target: MapFuelReportTarget | null) {
	if (!target) {
		return "";
	}

	return target.type === "listed"
		? (target.station.provinceCode ?? "")
		: (target.provinceCode ?? "");
}

function getInitialCityMunicipalityCode(target: MapFuelReportTarget | null) {
	if (!target) {
		return "";
	}

	return target.type === "listed"
		? (target.station.cityMunicipalityCode ?? "")
		: (target.cityMunicipalityCode ?? "");
}

function hasAnyCurrentStationPrice(station: GasStation) {
	return fuelTypes.some((fuelType) => {
		const price = station.prices[fuelType];
		const availability = station.fuelAvailability[fuelType];
		return (
			(typeof price === "number" &&
				Number.isFinite(price) &&
				price > 0) ||
			availability === "Out"
		);
	});
}

export function MapFuelReportDialog({
	open,
	target,
	provinces,
	cities,
	onOpenChange,
	onSubmitted,
}: MapFuelReportDialogProps) {
	const { user } = useAuth();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [priceForm, setPriceForm] = useState<FuelPriceFormMap>(() =>
		createEmptyFuelPriceFormMap(),
	);
	const [availabilityForm, setAvailabilityForm] = useState(() =>
		createEmptyFuelAvailabilityFormMap(),
	);
	const [provinceCode, setProvinceCode] = useState("");
	const [cityMunicipalityCode, setCityMunicipalityCode] = useState("");
	const [photoFile, setPhotoFile] = useState<File | null>(null);
	const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
	const [photoUploadError, setPhotoUploadError] = useState<string | null>(
		null,
	);
	const [submissionMode, setSubmissionMode] =
		useState<MapReportSubmissionMode>("standard");
	const [submissionError, setSubmissionError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const targetKey =
		target?.type === "listed"
			? `listed:${target.station.id}`
			: target
				? `discovered:${target.station.externalId}`
				: "none";

	useEffect(() => {
		if (!open || !target) {
			return;
		}

		setPriceForm(createEmptyFuelPriceFormMap());
		setAvailabilityForm(createEmptyFuelAvailabilityFormMap());
		setProvinceCode(getInitialProvinceCode(target));
		setCityMunicipalityCode(getInitialCityMunicipalityCode(target));
		setPhotoFile(null);
		setPhotoUploadError(null);
		setSubmissionMode("standard");
		setSubmissionError(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, [open, targetKey, target]);

	useEffect(() => {
		if (!photoFile) {
			setPhotoPreviewUrl(null);
			return;
		}

		const nextPreviewUrl = URL.createObjectURL(photoFile);
		setPhotoPreviewUrl(nextPreviewUrl);

		return () => {
			URL.revokeObjectURL(nextPreviewUrl);
		};
	}, [photoFile]);

	const availableCities = useMemo(
		() => cities.filter((city) => city.province_code === provinceCode),
		[cities, provinceCode],
	);

	const shouldShowScopeSelectors =
		target?.type === "discovered" ||
		(target?.type === "listed" &&
			(!target.station.provinceCode ||
				!target.station.cityMunicipalityCode));

	const currentPrices = useMemo(() => {
		if (target?.type !== "listed") {
			return [];
		}

		return fuelTypes
			.map((fuelType) => ({
				fuelType,
				price: target.station.prices[fuelType],
				availability: target.station.fuelAvailability[fuelType],
			}))
			.filter(
				(row) =>
					formatPrice(row.price) !== null ||
					row.availability === "Out",
			);
	}, [target]);

	const targetAddress = getStationDisplayAddress(target);
	const isEasyReport = submissionMode === "easy";

	const updateFuelPrice = (fuelType: FuelType, value: string) => {
		setPriceForm((current) => ({
			...current,
			[fuelType]: value,
		}));
	};

	const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
		if (!file) {
			return;
		}

		const validationError = validateFuelReportPhoto(file);
		if (validationError) {
			setPhotoFile(null);
			setPhotoUploadError(validationError);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}

		setPhotoFile(file);
		setPhotoUploadError(null);
	};

	const clearPhoto = () => {
		setPhotoFile(null);
		setPhotoUploadError(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!target) {
			return;
		}

		setSubmissionError(null);

		let uploadedPhoto: { path: string; filename: string } | null = null;

		setIsSubmitting(true);

		try {
			if (shouldShowScopeSelectors) {
				if (!provinceCode || !cityMunicipalityCode) {
					throw new Error(
						"Select the province and city/municipality.",
					);
				}
			}

			const resolvedProvinceCode =
				target.type === "listed"
					? target.station.provinceCode || provinceCode
					: provinceCode;
			const resolvedCityMunicipalityCode =
				target.type === "listed"
					? target.station.cityMunicipalityCode ||
						cityMunicipalityCode
					: cityMunicipalityCode;

			const prices = isEasyReport
				? createEmptyFuelPriceFormMap()
				: parseFuelPriceForm(priceForm);
			const fuelAvailability = isEasyReport
				? createEmptyFuelAvailabilityFormMap()
				: deriveFuelAvailabilityFromPrices(
						prices,
						parseFuelAvailabilityForm(availabilityForm),
					);

			if (!isEasyReport) {
				validateFuelPriceAvailability(prices, fuelAvailability);

				if (!hasAnyFuelAvailability(fuelAvailability)) {
					throw new Error("Add at least one fuel price.");
				}

				const fallbackFuelType =
					target.type === "listed"
						? target.station.fuelType
						: undefined;
				const summarySelection = getFuelSummarySelection(
					prices,
					fuelAvailability,
					fallbackFuelType,
				);
				if (!summarySelection) {
					throw new Error("Add at least one fuel price.");
				}
			}

			if (isEasyReport && !photoFile) {
				throw new Error("Upload a fuel price photo for Easy Report.");
			}

			if (photoFile) {
				uploadedPhoto = await uploadFuelReportPhoto({
					file: photoFile,
					userId: user?.id,
					folderName: user
						? undefined
						: `anonymous/${crypto.randomUUID()}`,
				});
			}

			const { error } = await supabase.rpc("submit_map_fuel_report", {
				_station_id:
					target.type === "listed" ? target.station.id : null,
				_station_name: target.station.name,
				_reported_address: targetAddress,
				_lat: target.station.lat,
				_lng: target.station.lng,
				_province_code: resolvedProvinceCode || null,
				_city_municipality_code: resolvedCityMunicipalityCode || null,
				_prices: prices,
				_fuel_availability: fuelAvailability,
				_photo_path: uploadedPhoto?.path ?? null,
				_photo_filename: uploadedPhoto?.filename ?? null,
				_submission_mode: submissionMode,
			});

			if (error) {
				throw new Error(
					error.message || "Fuel report could not be submitted.",
				);
			}

			toast.success(
				isEasyReport
					? "Easy report submitted. It will be reviewed before going public."
					: "Fuel price report submitted. It will be reviewed before going public.",
			);
			onSubmitted?.();
			onOpenChange(false);
		} catch (error) {
			if (uploadedPhoto?.path) {
				await removeFuelReportPhoto(uploadedPhoto.path).catch(
					() => undefined,
				);
			}

			const message =
				error instanceof Error
					? error.message
					: "Fuel report could not be submitted.";
			setSubmissionError(message);
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!target) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-none flex-col overflow-hidden rounded-none border-x-0 p-0 sm:h-auto sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:rounded-2xl sm:border-x sm:p-0">
				<form
					onSubmit={(event) => void handleSubmit(event)}
					className="flex min-h-0 flex-1 flex-col"
				>
					<DialogHeader className="shrink-0 border-b border-border px-4 pb-4 pt-5 pr-4 text-left sm:px-6 sm:pt-6">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<DialogTitle>Report fuel prices</DialogTitle>
								<DialogDescription className="mt-1 text-xs">
									{isEasyReport
										? "Upload a pump or price-board photo for manual review."
										: "Enter only the fuel prices you want to report."}
								</DialogDescription>
							</div>
							<ToggleGroup
								type="single"
								value={submissionMode}
								onValueChange={(value) => {
									if (
										value === "standard" ||
										value === "easy"
									) {
										setSubmissionMode(value);
										setSubmissionError(null);
									}
								}}
								className="absolute right-1/2 translate-x-1/2 top-14 lg:top-[60px] mt-1 grid w-1/3 grid-cols-2 rounded-lg border border-border bg-surface-alt/10 backdrop-blur-sm p-0.5 sm:w-auto"
							>
								<ToggleGroupItem
									value="standard"
									aria-label="Use Standard report"
									className="h-5 rounded-sm px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
								>
									Standard
								</ToggleGroupItem>
								<ToggleGroupItem
									value="easy"
									aria-label="Use Easy report"
									className="h-5 rounded-sm px-3 text-xs data-[state=on]:bg-amber-600 data-[state=on]:text-white"
								>
									Easy
								</ToggleGroupItem>
							</ToggleGroup>
						</div>
					</DialogHeader>

					<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5">
						<section className="rounded-2xl border border-border bg-surface-alt/70 p-3 sm:p-4">
							<div className="flex flex-wrap items-start justify-between gap-3 relative">
								<div className="min-w-0 ">
									<div className="flex flex-wrap items-center gap-2">
										<h3 className="min-w-0 break-words text-base font-semibold leading-snug text-foreground">
											{target.station.name}
										</h3>
										<Badge
											variant="outline"
											className="absolute -top-6 right-0 bg-card"
										>
											{target.type === "listed"
												? "Listed station"
												: "Discovered station"}
										</Badge>
									</div>
									<p className=" flex gap-2 text-[10px] text-muted-foreground">
										<MapPin className="mt-0.5 h-2 w-2 shrink-0" />
										<span className="min-w-0 break-words">
											{targetAddress}
										</span>
									</p>
								</div>
							</div>

							{target.type === "listed" ? (
								<div className="mt-2 rounded-sm border border-border bg-background/70 p-3">
									<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Current station prices
									</p>
									{hasAnyCurrentStationPrice(
										target.station,
									) && currentPrices.length > 0 ? (
										<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
											{currentPrices.map((row) => {
												const priceText = formatPrice(
													row.price,
												);
												const statusText =
													row.availability === "Out"
														? "Out"
														: row.availability &&
															  isFuelSellable(
																	row.availability,
															  )
															? row.availability
															: null;

												return (
													<div
														key={`current-${row.fuelType}`}
														className={`rounded-sm border border-border bg-card px-3 py-2 flex items-center gap-4 `}
													>
														<p className="text-sm font-medium ">
															{row.fuelType}
														</p>
														<p
															className={`ml-auto text-sm font-semibold ${fuelTypeTextColorClassNames[row.fuelType]}`}
														>
															{priceText ??
																"--.--"}
														</p>
													</div>
												);
											})}
										</div>
									) : (
										<p className="mt-2 text-sm text-muted-foreground">
											No current prices have been added
											for this station yet.
										</p>
									)}
								</div>
							) : null}
						</section>

						{shouldShowScopeSelectors ? (
							<section className="grid gap-3 rounded-2xl border border-border bg-card/70 p-3 sm:grid-cols-2 sm:p-4">
								<div className="space-y-2">
									<Label htmlFor="map-report-province">
										Province
									</Label>
									<Select
										value={
											provinceCode || EMPTY_SELECT_VALUE
										}
										onValueChange={(value) => {
											const nextProvince =
												value === EMPTY_SELECT_VALUE
													? ""
													: value;
											setProvinceCode(nextProvince);
											setCityMunicipalityCode("");
										}}
									>
										<SelectTrigger id="map-report-province">
											<SelectValue placeholder="Select province" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem
												value={EMPTY_SELECT_VALUE}
											>
												Select province
											</SelectItem>
											{provinces.map((province) => (
												<SelectItem
													key={province.code}
													value={province.code}
												>
													{province.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="map-report-city">
										City/Municipality
									</Label>
									<Select
										value={
											cityMunicipalityCode ||
											EMPTY_SELECT_VALUE
										}
										onValueChange={(value) =>
											setCityMunicipalityCode(
												value === EMPTY_SELECT_VALUE
													? ""
													: value,
											)
										}
										disabled={!provinceCode}
									>
										<SelectTrigger id="map-report-city">
											<SelectValue placeholder="Select city/municipality" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem
												value={EMPTY_SELECT_VALUE}
											>
												Select city/municipality
											</SelectItem>
											{availableCities.map((city) => (
												<SelectItem
													key={city.code}
													value={city.code}
												>
													{city.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</section>
						) : null}

						{isEasyReport ? null : (
							<section className="space-y-3">
								<div>
									<h3 className="text-sm font-semibold text-foreground">
										Fuel prices to report
									</h3>
									<p className="mt-1 text-[10px] text-muted-foreground">
										Enter only the fuels you want to report.
										Rows left blank will be ignored.
									</p>
								</div>

								<div className="grid gap-2 sm:gap-3 grid-cols-2">
									{fuelTypes.map((fuelType) => (
										<div
											key={fuelType}
											className="grid gap-2 rounded-sm border border-border bg-card/70 py-1 px-1 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center lg:grid-cols-[minmax(0,1fr)_180px]"
										>
											<div className="flex min-w-0 items-center pl-1">
												<p
													className={`text-sm font-semibold ${fuelTypeTextColorClassNames[fuelType]}`}
												>
													{fuelType}
												</p>
											</div>
											<div className="space-y-1.5">
												<Input
													id={`map-report-price-${fuelType}`}
													inputMode="decimal"
													placeholder="00.00"
													value={priceForm[fuelType]}
													className="h-11 text-base sm:h-8 sm:text-sm !rounded-sm"
													onChange={(event) =>
														updateFuelPrice(
															fuelType,
															event.target.value,
														)
													}
												/>
											</div>
										</div>
									))}
								</div>
							</section>
						)}

						<section className="rounded-2xl border border-border bg-card/70 p-3 sm:p-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h3 className="text-sm font-semibold text-foreground">
										Verification photo
									</h3>
									<p className="mt-1 text-xs text-muted-foreground">
										{isEasyReport
											? "Required for Easy Report. JPG, JPEG, or PNG, up to 10MB."
											: "Optional. JPG, JPEG, or PNG, up to 10MB."}
									</p>
								</div>
								{photoFile ? (
									<button
										type="button"
										onClick={clearPhoto}
										className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
									>
										<X className="h-3.5 w-3.5" />
										Remove
									</button>
								) : null}
							</div>

							<label className="mt-3 flex cursor-pointer flex-col items-stretch gap-3 rounded-xl border border-dashed border-border bg-surface-alt px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex-row sm:flex-wrap sm:items-center">
								<div className="flex items-center gap-2">
									<ImagePlus className="h-4 w-4 shrink-0" />
									<span className="min-w-0 flex break-words sm:truncate text-xs">
										{photoFile
											? photoFile.name
											: "Choose a verification photo"}
									</span>
								</div>
								<span className="rounded-full bg-background px-3 py-2 text-center text-xs font-medium text-foreground">
									{photoFile ? "Replace" : "Browse"}
								</span>
								<input
									ref={fileInputRef}
									type="file"
									accept={FUEL_REPORT_FILE_INPUT_ACCEPT}
									onChange={handlePhotoChange}
									className="hidden"
								/>
							</label>

							{photoPreviewUrl ? (
								<div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-alt">
									<img
										src={photoPreviewUrl}
										alt={
											photoFile?.name ||
											"Selected report photo"
										}
										className="h-44 w-full object-cover"
									/>
								</div>
							) : null}

							{photoUploadError ? (
								<p className="mt-2 text-xs text-destructive">
									{photoUploadError}
								</p>
							) : null}
						</section>

						{submissionError ? (
							<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{submissionError}
							</div>
						) : null}
					</div>

					<DialogFooter className="shrink-0 gap-2 border-t border-border bg-background/95 px-4 py-3 sm:px-6 sm:py-4 [&>button]:w-full sm:[&>button]:w-auto">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Submitting...
								</>
							) : (
								"Submit report"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

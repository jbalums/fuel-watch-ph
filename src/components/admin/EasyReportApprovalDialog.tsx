import {
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type {
	GeoCityMunicipality,
	GeoProvince,
} from "@/hooks/useGeoReferences";
import { createFuelReportPhotoUrl } from "@/lib/fuel-report-photo-upload";
import { fuelTypes, stationStatuses } from "@/lib/fuel-prices";
import type { FuelReport } from "@/types/station";
import type { GasStationRow } from "@/components/admin/admin-shared";
import type { EasyReportApprovalFormState } from "@/components/admin/admin-shared";
import { EasyReportStationPickerMap } from "@/components/admin/EasyReportStationPickerMap";

type StationOption = GasStationRow;

interface EasyReportApprovalDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	report: FuelReport | null;
	form: EasyReportApprovalFormState | null;
	setForm: Dispatch<SetStateAction<EasyReportApprovalFormState | null>>;
	stations: StationOption[];
	provinces: GeoProvince[];
	cities: GeoCityMunicipality[];
	onApprove: () => void;
	approving: boolean;
	validationMessage?: string | null;
}

export function EasyReportApprovalDialog({
	open,
	onOpenChange,
	report,
	form,
	setForm,
	stations,
	provinces,
	cities,
	onApprove,
	approving,
	validationMessage,
}: EasyReportApprovalDialogProps) {
	const [photoUrl, setPhotoUrl] = useState<string | null>(null);
	const [photoError, setPhotoError] = useState<string | null>(null);
	const [photoLoading, setPhotoLoading] = useState(false);
	const stationLookup = useMemo(
		() => new Map(stations.map((station) => [station.id, station])),
		[stations],
	);
	const reportLocation = useMemo(
		() =>
			report?.lat !== null && report?.lng !== null
				? {
						lat: report?.lat,
						lng: report?.lng,
					}
				: null,
		[report?.lat, report?.lng],
	);

	const availableCities = useMemo(
		() =>
			form?.provinceCode
				? cities.filter(
						(city) => city.province_code === form.provinceCode,
					)
				: [],
		[cities, form?.provinceCode],
	);

	const updateForm = (
		updater: (
			current: EasyReportApprovalFormState,
		) => EasyReportApprovalFormState,
	) => {
		setForm((current) => (current ? updater(current) : current));
	};

	const applyStationSelection = (stationId: string) => {
		const station = stationLookup.get(stationId) ?? null;
		if (!station) {
			return;
		}

		updateForm((current) => ({
			...current,
			stationId,
			stationName: station.name ?? current.stationName,
			reportedAddress: station.address ?? current.reportedAddress,
			provinceCode: station.province_code ?? current.provinceCode,
			cityMunicipalityCode:
				station.city_municipality_code ?? current.cityMunicipalityCode,
		}));
	};

	useEffect(() => {
		if (!open || !report?.photoPath) {
			setPhotoUrl(null);
			setPhotoError(null);
			setPhotoLoading(false);
			return;
		}

		let cancelled = false;
		setPhotoLoading(true);
		setPhotoError(null);

		void createFuelReportPhotoUrl(report.photoPath)
			.then((url) => {
				if (cancelled) {
					return;
				}

				setPhotoUrl(url);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				setPhotoError(
					error instanceof Error
						? error.message
						: "Failed to load Easy Report photo",
				);
				setPhotoUrl(null);
			})
			.finally(() => {
				if (!cancelled) {
					setPhotoLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [open, report?.photoPath]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Complete and approve easy report</DialogTitle>
					<DialogDescription>
						Review the uploaded photo and manually enter the station
						details, prices, and per-fuel availability before
						approval.
					</DialogDescription>
				</DialogHeader>

				{report && form ? (
					<div className="flex flex-col gap-5">
						<div className="rounded-xl border border-border bg-secondary/40 p-4">
							<p className="text-sm font-medium text-foreground">
								Reporter pinned this location and uploaded a
								reference photo. Use it to complete the station
								data below.
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{report.reportedAddress ??
									(report.lat !== null && report.lng !== null
										? `GPS: ${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`
										: "No address or GPS supplied")}
							</p>
						</div>

						<div className="grid gap-4 lg:grid-cols-1">
							<div className="rounded-xl border border-border bg-background p-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-sm font-medium text-foreground">
											Reference Photo
										</p>
										<p className="text-xs text-muted-foreground">
											Review this image while entering
											fuel prices.
										</p>
									</div>
									{photoUrl ? (
										<button
											type="button"
											onClick={() =>
												window.open(
													photoUrl,
													"_blank",
													"noopener,noreferrer",
												)
											}
											className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary/80"
										>
											<ExternalLink className="h-3.5 w-3.5" />
											Open Full Image
										</button>
									) : null}
								</div>
								{report.photoFilename ? (
									<p className="mt-1 text-xs text-muted-foreground">
										{report.photoFilename}
									</p>
								) : null}
								<div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-alt">
									{photoLoading ? (
										<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Loading report photo...
										</div>
									) : photoUrl ? (
										<img
											src={photoUrl}
											alt={
												report.photoFilename ??
												"Easy Report reference photo"
											}
											className=" w-full object-contain bg-black/5"
										/>
									) : (
										<div className="flex h-64 items-center justify-center px-4 text-center text-sm text-muted-foreground">
											{photoError ??
												"No photo is attached to this Easy Report."}
										</div>
									)}
								</div>
							</div>

							<EasyReportStationPickerMap
								reportLocation={reportLocation}
								stations={stations
									.filter(
										(station) =>
											typeof station.lat === "number" &&
											typeof station.lng === "number",
									)
									.map((station) => ({
										id: station.id,
										name: station.name,
										address: station.address,
										lat: station.lat,
										lng: station.lng,
										status: station.status,
										stationBrandLogoId:
											station.station_brand_logo_id,
									}))}
								selectedStationId={form.stationId}
								onStationSelect={applyStationSelection}
							/>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="flex flex-col gap-1.5">
								<label className="text-label text-muted-foreground">
									Existing Station (Optional)
								</label>
								<select
									value={form.stationId}
									onChange={(event) => {
										const nextStationId =
											event.target.value;
										if (!nextStationId) {
											updateForm((current) => ({
												...current,
												stationId: "",
											}));
											return;
										}

										applyStationSelection(nextStationId);
									}}
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								>
									<option value="">
										Create or match manually
									</option>
									{stations.map((station) => (
										<option
											key={station.id}
											value={station.id}
										>
											{station.name ?? "Unnamed station"}
										</option>
									))}
								</select>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-label text-muted-foreground">
									Station Name
								</label>
								<input
									type="text"
									value={form.stationName}
									onChange={(event) =>
										updateForm((current) => ({
											...current,
											stationName: event.target.value,
										}))
									}
									placeholder="e.g. Petron EDSA Cubao"
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								/>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Resolved Address
							</label>
							<textarea
								value={form.reportedAddress}
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										reportedAddress: event.target.value,
									}))
								}
								rows={3}
								placeholder="Optional address or landmark details"
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Geographic Scope
							</label>
							<GeoScopeFields
								provinces={provinces}
								cities={availableCities}
								provinceCode={form.provinceCode}
								cityMunicipalityCode={form.cityMunicipalityCode}
								requestedRole="city_admin"
								onProvinceChange={(nextProvinceCode) =>
									updateForm((current) => ({
										...current,
										provinceCode: nextProvinceCode,
										cityMunicipalityCode: "",
									}))
								}
								onCityChange={(nextCityCode) =>
									updateForm((current) => ({
										...current,
										cityMunicipalityCode: nextCityCode,
									}))
								}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-label text-muted-foreground">
								Fuel Prices and Availability
							</label>
							<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
								{fuelTypes.map((fuelType) => (
									<div
										key={fuelType}
										className="rounded-xl border border-border bg-background p-3"
									>
										<p className="text-xs font-semibold text-foreground">
											{fuelType}
										</p>
										<input
											type="number"
											step="0.01"
											value={form.prices[fuelType]}
											onChange={(event) =>
												updateForm((current) => ({
													...current,
													prices: {
														...current.prices,
														[fuelType]:
															event.target.value,
													},
												}))
											}
											placeholder="0.00"
											className="mt-2 w-full rounded-xl bg-surface-alt px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
										/>
										<select
											value={
												form.fuelAvailability[fuelType]
											}
											onChange={(event) => {
												const nextStatus = event.target
													.value as
													| ""
													| "Available"
													| "Low"
													| "Out";

												updateForm((current) => ({
													...current,
													prices: {
														...current.prices,
														[fuelType]:
															nextStatus === "Out"
																? ""
																: current
																		.prices[
																		fuelType
																	],
													},
													fuelAvailability: {
														...current.fuelAvailability,
														[fuelType]: nextStatus,
													},
												}));
											}}
											className="mt-2 w-full rounded-xl bg-surface-alt px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
										>
											<option value="">No data</option>
											{stationStatuses.map((status) => (
												<option
													key={status}
													value={status}
												>
													{status}
												</option>
											))}
										</select>
									</div>
								))}
							</div>
						</div>

						{validationMessage ? (
							<p className="text-sm text-destructive">
								{validationMessage}
							</p>
						) : null}
					</div>
				) : null}

				<DialogFooter>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						disabled={approving}
						className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onApprove}
						disabled={approving || !form}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
					>
						{approving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : null}
						{approving ? "Approving..." : "Approve report"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

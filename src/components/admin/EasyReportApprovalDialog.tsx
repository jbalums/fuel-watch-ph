import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Loader2 } from "lucide-react";
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
import { fuelTypes, stationStatuses } from "@/lib/fuel-prices";
import type { FuelReport } from "@/types/station";
import type { EasyReportApprovalFormState } from "@/components/admin/admin-shared";

type StationOption = {
	id: string;
	name: string | null;
	address: string | null;
	province_code: string | null;
	city_municipality_code: string | null;
};

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
	const stationLookup = useMemo(
		() => new Map(stations.map((station) => [station.id, station])),
		[stations],
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
		updater: (current: EasyReportApprovalFormState) => EasyReportApprovalFormState,
	) => {
		setForm((current) => (current ? updater(current) : current));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Complete and approve easy report</DialogTitle>
					<DialogDescription>
						Review the uploaded photo and manually enter the station
						details, prices, and per-fuel availability before approval.
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
										const station = nextStationId
											? stationLookup.get(nextStationId) ??
												null
											: null;

										updateForm((current) => ({
											...current,
											stationId: nextStationId,
											stationName:
												station?.name ??
												current.stationName,
											reportedAddress:
												station?.address ??
												current.reportedAddress,
											provinceCode:
												station?.province_code ??
												current.provinceCode,
											cityMunicipalityCode:
												station?.city_municipality_code ??
												current.cityMunicipalityCode,
										}));
									}}
									className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
								>
									<option value="">Create or match manually</option>
									{stations.map((station) => (
										<option key={station.id} value={station.id}>
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
								cityMunicipalityCode={
									form.cityMunicipalityCode
								}
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
											value={form.fuelAvailability[fuelType]}
											onChange={(event) => {
												const nextStatus =
													event.target.value as
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
																: current.prices[
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
												<option key={status} value={status}>
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

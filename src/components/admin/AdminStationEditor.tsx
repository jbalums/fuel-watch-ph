import { StationLocationPicker } from "@/components/StationLocationPicker";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { fuelTypes } from "@/lib/fuel-prices";
import type { FuelType, StationStatus } from "@/types/station";
import type { GasStationRow, StationFormState } from "./admin-shared";

interface AdminStationEditorProps {
	open: boolean;
	mode: "create" | "edit";
	form: StationFormState;
	stations: GasStationRow[];
	isMobile: boolean;
	isSaving: boolean;
	lockedProvinceCode?: string | null;
	lockedCityMunicipalityCode?: string | null;
	onOpenChange: (open: boolean) => void;
	onFormChange: (
		updater:
			| StationFormState
			| ((current: StationFormState) => StationFormState),
	) => void;
	onSubmit: () => void;
	onCancel: () => void;
}

function EditorForm({
	mode,
	form,
	stations,
	isSaving,
	lockedProvinceCode,
	lockedCityMunicipalityCode,
	onFormChange,
	onSubmit,
	onCancel,
}: Omit<AdminStationEditorProps, "open" | "isMobile" | "onOpenChange">) {
	const { provinces, citiesByProvince } = useGeoReferences();
	const visibleCities = form.provinceCode
		? citiesByProvince.get(form.provinceCode) ?? []
		: [];

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit();
			}}
			className="flex h-full flex-col overflow-hidden"
		>
			<div className="flex-1 overflow-y-auto px-4 py-5 max-h-[calc(100vh-160px)]">
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
					<StationLocationPicker
						value={{
							lat: form.lat,
							lng: form.lng,
						}}
						onChange={(coords) =>
							onFormChange((current) => ({
								...current,
								lat: coords.lat,
								lng: coords.lng,
							}))
						}
						onAddressResolved={(address) =>
							onFormChange((current) => ({
								...current,
								address,
							}))
						}
						existingStations={stations.map((station) => ({
							lat: station.lat,
							lng: station.lng,
						}))}
					/>
					<div className="md:col-span-2">
						<GeoScopeFields
							provinces={provinces}
							cities={visibleCities}
							provinceCode={form.provinceCode}
							cityMunicipalityCode={form.cityMunicipalityCode}
							provinceDisabled={!!lockedProvinceCode}
							cityDisabled={!!lockedCityMunicipalityCode}
							onProvinceChange={(provinceCode) =>
								onFormChange((current) => ({
									...current,
									provinceCode,
									cityMunicipalityCode:
										lockedCityMunicipalityCode &&
										provinceCode === lockedProvinceCode
											? lockedCityMunicipalityCode
											: "",
								}))
							}
							onCityChange={(cityCode) =>
								onFormChange((current) => ({
									...current,
									cityMunicipalityCode: cityCode,
								}))
							}
						/>
					</div>
					<select
						value={form.fuelType}
						onChange={(event) =>
							onFormChange((current) => ({
								...current,
								fuelType: event.target.value as FuelType,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						{fuelTypes.map((fuelType) => (
							<option key={fuelType} value={fuelType}>
								{fuelType}
							</option>
						))}
					</select>
					<select
						value={form.status}
						onChange={(event) =>
							onFormChange((current) => ({
								...current,
								status: event.target.value as StationStatus,
							}))
						}
						className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						<option value="Available">Available</option>
						<option value="Low">Low</option>
						<option value="Out">Out</option>
					</select>
					<div className="rounded-lg border border-border bg-background p-3 md:col-span-2">
						<div className="mb-3 flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-medium text-foreground">
									Current Prices
								</p>
								<p className="text-xs text-muted-foreground">
									Add each available fuel price. The selected
									fuel type becomes the main displayed price.
								</p>
							</div>
							<span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
								Primary: <b>{form.fuelType}</b>
							</span>
						</div>
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
													[fuelType]:
														event.target.value,
												},
											}))
										}
										className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
									/>
								</div>
							))}
						</div>
						<p className="mt-3 text-xs text-muted-foreground">
							Current display price:{" "}
							{form.prices[form.fuelType]
								? `₱${Number(form.prices[form.fuelType]).toFixed(2)}`
								: "Set a price for the selected fuel type"}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-background p-3 md:col-span-2">
						<div className="mb-3">
							<p className="text-sm font-medium text-foreground">
								Previous Prices
							</p>
							<p className="text-xs text-muted-foreground">
								Set previous fuel prices manually when you need
								to seed or correct trend comparisons.
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							{fuelTypes.map((fuelType) => (
								<div
									key={`previous-${fuelType}`}
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
													[fuelType]:
														event.target.value,
												},
											}))
										}
										className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
									/>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="border-t border-border bg-background px-4 py-4">
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<button
						type="button"
						onClick={onCancel}
						disabled={isSaving}
						className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSaving}
						className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
					>
						{isSaving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : null}
						{mode === "edit" ? "Save Station" : "Create Station"}
					</button>
				</div>
			</div>
		</form>
	);
}

export function AdminStationEditor({
	open,
	mode,
	form,
	stations,
	isMobile,
	isSaving,
	lockedProvinceCode,
	lockedCityMunicipalityCode,
	onOpenChange,
	onFormChange,
	onSubmit,
	onCancel,
}: AdminStationEditorProps) {
	const title = mode === "edit" ? "Edit Station" : "Add Station";
	const description =
		mode === "edit"
			? "Update station details, current and previous prices, and map location."
			: "Create a new station record with location, current prices, and optional previous prices.";

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent className="max-h-[92vh] p-0">
					<DrawerHeader className="border-b border-border px-4 pb-4 !space-y-0">
						<DrawerTitle>{title}</DrawerTitle>
						<DrawerDescription>{description}</DrawerDescription>
					</DrawerHeader>
					<EditorForm
						mode={mode}
						form={form}
						stations={stations}
						isSaving={isSaving}
						lockedProvinceCode={lockedProvinceCode}
						lockedCityMunicipalityCode={lockedCityMunicipalityCode}
						onFormChange={onFormChange}
						onSubmit={onSubmit}
						onCancel={onCancel}
					/>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full max-w-none overflow-hidden p-0 sm:max-w-none md:w-[min(92vw,1100px)]"
			>
				<SheetHeader className="border-b border-border px-6 py-4 space-y-0">
					<SheetTitle>{title}</SheetTitle>
					<SheetDescription>{description}</SheetDescription>
				</SheetHeader>
				<EditorForm
					mode={mode}
					form={form}
					stations={stations}
					isSaving={isSaving}
					lockedProvinceCode={lockedProvinceCode}
					lockedCityMunicipalityCode={lockedCityMunicipalityCode}
					onFormChange={onFormChange}
					onSubmit={onSubmit}
					onCancel={onCancel}
				/>
			</SheetContent>
		</Sheet>
	);
}

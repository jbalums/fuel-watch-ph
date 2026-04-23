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
import { Loader2, MapPinned } from "lucide-react";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useStationBrandLogos } from "@/hooks/useStationBrandLogos";
import { toast } from "@/lib/app-toast";
import { detectGeoScopeFromAddress } from "@/lib/geo-detection";
import { fuelTypes } from "@/lib/fuel-prices";
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
	const { provinces, cities, citiesByProvince } = useGeoReferences({
		provinceCode: form.provinceCode,
		includeAllCities: true,
	});
	const { data: stationBrandLogos = [] } = useStationBrandLogos();
	const visibleCities = form.provinceCode
		? citiesByProvince.get(form.provinceCode) ?? []
		: [];
	const handleAutoDetectScope = () => {
		if (!form.address.trim()) {
			toast.error("Enter or resolve a station address first");
			return;
		}

		const detectedScope = detectGeoScopeFromAddress({
			address: form.address,
			provinces,
			cities,
		});

		if (!detectedScope) {
			toast.info("Could not auto-detect the province and city from this address");
			return;
		}

		const detectedProvinceCode = detectedScope.provinceCode ?? "";
		const detectedCityCode = detectedScope.cityMunicipalityCode ?? "";
		const nextProvinceCode = lockedProvinceCode ?? detectedProvinceCode;
		const nextCityCode = lockedCityMunicipalityCode
			? lockedCityMunicipalityCode
			: lockedProvinceCode && detectedProvinceCode !== lockedProvinceCode
				? ""
				: detectedCityCode;

		onFormChange((current) => ({
			...current,
			provinceCode: nextProvinceCode,
			cityMunicipalityCode: nextCityCode,
		}));

		toast.success(
			nextCityCode
				? "Province and city auto-detected"
				: "Province auto-detected",
		);
	};

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
						<div className="mb-3 rounded-lg border border-border bg-background p-3">
							<p className="text-sm font-medium text-foreground">
								Marker Logo Override
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Leave this on auto-match to resolve the map logo
								from the station name. Choose a brand only when
								you need to override that behavior.
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
						<div className="mb-3 flex items-center justify-end">
							<button
								type="button"
								onClick={handleAutoDetectScope}
								className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
							>
								<MapPinned className="h-3.5 w-3.5" />
								Auto Detect Province / City
							</button>
						</div>
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
					<div className="rounded-lg border border-border bg-background p-3 md:col-span-2">
						<div className="mb-3">
							<div>
								<p className="text-sm font-medium text-foreground">
									Current Prices
								</p>
								<p className="text-xs text-muted-foreground">
									Set each fuel's price. The main displayed
									fuel is derived automatically from the fuel
									rows.
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
							{mode === "edit"
								? "Prices are optional during editing. Blank fields are ignored when you have no current data yet."
								: "Add at least one valid fuel price. Blank fields are ignored when you have no data for that fuel."}
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
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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

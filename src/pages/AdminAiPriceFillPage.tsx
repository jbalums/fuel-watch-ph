import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useStationBrandLogos } from "@/hooks/useStationBrandLogos";
import { resolveStationBrandLogo } from "@/lib/station-brand-logos";
import { fuelTypes } from "@/lib/fuel-prices";
import {
	refreshAdminData,
	useAdminStations,
	type GasStationRow,
} from "@/components/admin/admin-shared";
import { useUserAccess } from "@/hooks/useUserAccess";
import type { FuelType } from "@/types/station";

type WizardStep = "scope" | "prompt" | "results";

interface AiPriceResult {
	brand: string;
	fuelType: string;
	price: number | null;
	currency: string;
	source: string;
	asOf: string;
	confidence: "high" | "medium" | "low";
}

interface ResultRow {
	key: string;
	brand: string;
	fuelType: FuelType;
	matchedBrandId: string | null;
	currentAvg: number | null;
	priceInput: string;
	source: string;
	asOf: string;
	confidence: "high" | "medium" | "low";
	accepted: boolean;
}

const confidenceVariant: Record<
	ResultRow["confidence"],
	"default" | "secondary" | "outline"
> = {
	high: "default",
	medium: "secondary",
	low: "outline",
};

function stationPrices(station: GasStationRow): Record<string, number | null> {
	return (station.prices as Record<string, number | null> | null) ?? {};
}

export default function AdminAiPriceFillPage() {
	const queryClient = useQueryClient();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const { data: brandLogos = [] } = useStationBrandLogos();
	const { data: stations = [] } = useAdminStations();

	const [step, setStep] = useState<WizardStep>("scope");
	const [provinceCode, setProvinceCode] = useState("");
	const [cityCode, setCityCode] = useState("");
	const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
	const [selectedFuelTypes, setSelectedFuelTypes] = useState<FuelType[]>([
		...fuelTypes,
	]);
	const [promptText, setPromptText] = useState("");
	const [rows, setRows] = useState<ResultRow[]>([]);

	const { provinces, cities } = useGeoReferences({ provinceCode });

	const activeBrands = useMemo(
		() => brandLogos.filter((brand) => brand.isActive),
		[brandLogos],
	);

	const regionLabel = useMemo(() => {
		const provinceName = provinces.find(
			(province) => province.code === provinceCode,
		)?.name;
		const cityName = cities.find((city) => city.code === cityCode)?.name;
		return [cityName, provinceName].filter(Boolean).join(", ");
	}, [provinces, cities, provinceCode, cityCode]);

	// Stations within the selected region, grouped by resolved brand id.
	const stationsByBrandId = useMemo(() => {
		const grouped = new Map<string, GasStationRow[]>();
		for (const station of stations) {
			if (provinceCode && station.province_code !== provinceCode) continue;
			if (cityCode && station.city_municipality_code !== cityCode) continue;

			const matched = resolveStationBrandLogo(
				{
					name: station.name,
					stationBrandLogoId: station.station_brand_logo_id,
				},
				brandLogos,
			);
			if (!matched) continue;

			const current = grouped.get(matched.id) ?? [];
			current.push(station);
			grouped.set(matched.id, current);
		}
		return grouped;
	}, [stations, brandLogos, provinceCode, cityCode]);

	const selectedBrandNames = useMemo(
		() =>
			activeBrands
				.filter((brand) => selectedBrandIds.includes(brand.id))
				.map((brand) => brand.brandName),
		[activeBrands, selectedBrandIds],
	);

	function toggleBrand(id: string) {
		setSelectedBrandIds((prev) =>
			prev.includes(id)
				? prev.filter((value) => value !== id)
				: [...prev, id],
		);
	}

	function toggleFuelType(fuelType: FuelType) {
		setSelectedFuelTypes((prev) =>
			prev.includes(fuelType)
				? prev.filter((value) => value !== fuelType)
				: [...prev, fuelType],
		);
	}

	function buildPrompt() {
		const lines = [
			`Find the latest published pump fuel prices for ${
				regionLabel || "the Philippines"
			}.`,
			selectedBrandNames.length
				? `Brands: ${selectedBrandNames.join(", ")}.`
				: "All major brands.",
			selectedFuelTypes.length
				? `Fuel types: ${selectedFuelTypes.join(", ")}.`
				: "",
			"Return one price per brand per fuel type, in PHP per liter, with the source URL and publish date.",
		].filter(Boolean);
		return lines.join("\n");
	}

	function goToPromptStep() {
		if (!provinceCode) {
			toast.error("Select a province first");
			return;
		}
		if (selectedBrandIds.length === 0) {
			toast.error("Select at least one brand");
			return;
		}
		if (selectedFuelTypes.length === 0) {
			toast.error("Select at least one fuel type");
			return;
		}
		setPromptText(buildPrompt());
		setStep("prompt");
	}

	function averageBrandPrice(
		brandId: string | null,
		fuelType: FuelType,
	): number | null {
		if (!brandId) return null;
		const brandStations = stationsByBrandId.get(brandId) ?? [];
		const values = brandStations
			.map((station) => stationPrices(station)[fuelType])
			.filter(
				(value): value is number =>
					typeof value === "number" && Number.isFinite(value) && value > 0,
			);
		if (values.length === 0) return null;
		return Number(
			(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2),
		);
	}

	const runLookup = useMutation({
		mutationFn: async () => {
			const { data, error } = await supabase.functions.invoke(
				"ai-fuel-prices",
				{
					body: {
						prompt: promptText,
						brands: selectedBrandNames,
						fuelTypes: selectedFuelTypes,
						region: { provinceName: regionLabel },
					},
				},
			);
			if (error) throw error;
			return (data?.results ?? []) as AiPriceResult[];
		},
		onSuccess: (results) => {
			const mapped: ResultRow[] = results
				.filter((result) =>
					fuelTypes.includes(result.fuelType as FuelType),
				)
				.map((result, index) => {
					const matched = resolveStationBrandLogo(
						{ name: result.brand },
						brandLogos,
					);
					const fuelType = result.fuelType as FuelType;
					return {
						key: `${result.brand}-${result.fuelType}-${index}`,
						brand: result.brand,
						fuelType,
						matchedBrandId: matched?.id ?? null,
						currentAvg: averageBrandPrice(matched?.id ?? null, fuelType),
						priceInput:
							result.price !== null ? String(result.price) : "",
						source: result.source,
						asOf: result.asOf,
						confidence: result.confidence,
						accepted: result.price !== null && Boolean(matched),
					};
				});
			setRows(mapped);
			setStep("results");
			if (mapped.length === 0) {
				toast.warning("No usable prices returned");
			}
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const save = useMutation({
		mutationFn: async () => {
			// Accumulate accepted prices per target station.
			const perStation = new Map<string, Record<string, number>>();

			for (const row of rows) {
				if (!row.accepted || !row.matchedBrandId) continue;
				const price = Number.parseFloat(row.priceInput);
				if (!Number.isFinite(price) || price <= 0) continue;

				const brandStations =
					stationsByBrandId.get(row.matchedBrandId) ?? [];
				for (const station of brandStations) {
					const entry = perStation.get(station.id) ?? {};
					entry[row.fuelType] = Number(price.toFixed(2));
					perStation.set(station.id, entry);
				}
			}

			const updates = Array.from(perStation.entries()).map(
				([station_id, prices]) => ({ station_id, prices }),
			);

			if (updates.length === 0) {
				throw new Error(
					"No accepted prices matched any stations in this region",
				);
			}

			const { data, error } = await supabase.rpc("apply_ai_fuel_prices", {
				_updates: updates,
			});
			if (error) throw error;
			return data as number;
		},
		onSuccess: async (updatedCount) => {
			await refreshAdminData(queryClient);
			toast.success(`Updated ${updatedCount} station(s)`);
			setRows([]);
			setStep("scope");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const acceptedCount = rows.filter(
		(row) =>
			row.accepted &&
			row.matchedBrandId &&
			Number.parseFloat(row.priceInput) > 0,
	).length;

	if (accessLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isSuperAdmin) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							Super admin access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							AI price fill is only available to super admins.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center gap-3">
				<Sparkles className="h-5 w-5 text-primary" />
				<div>
					<h2 className="text-headline text-foreground">AI Price Fill</h2>
					<p className="text-sm text-muted-foreground">
						Populate fuel prices from the latest web search, review each
						result, then apply.
					</p>
				</div>
			</div>

			{step === "scope" && (
				<Card>
					<CardHeader>
						<CardTitle>1. Scope</CardTitle>
						<CardDescription>
							Choose the region, brands, and fuel types to look up.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						<GeoScopeFields
							provinces={provinces}
							cities={cities}
							provinceCode={provinceCode}
							cityMunicipalityCode={cityCode}
							onProvinceChange={(code) => {
								setProvinceCode(code);
								setCityCode("");
							}}
							onCityChange={setCityCode}
						/>

						<div className="flex flex-col gap-2">
							<Label>Brands</Label>
							<div className="flex flex-wrap gap-2">
								{activeBrands.map((brand) => {
									const checked = selectedBrandIds.includes(
										brand.id,
									);
									return (
										<button
											key={brand.id}
											type="button"
											onClick={() => toggleBrand(brand.id)}
											className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
												checked
													? "border-primary bg-primary text-primary-foreground"
													: "border-border bg-background text-muted-foreground hover:text-foreground"
											}`}
										>
											<Checkbox
												checked={checked}
												className="pointer-events-none"
											/>
											{brand.brandName}
										</button>
									);
								})}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<Label>Fuel types</Label>
							<div className="flex flex-wrap gap-2">
								{fuelTypes.map((fuelType) => {
									const checked =
										selectedFuelTypes.includes(fuelType);
									return (
										<button
											key={fuelType}
											type="button"
											onClick={() => toggleFuelType(fuelType)}
											className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
												checked
													? "border-primary bg-primary text-primary-foreground"
													: "border-border bg-background text-muted-foreground hover:text-foreground"
											}`}
										>
											<Checkbox
												checked={checked}
												className="pointer-events-none"
											/>
											{fuelType}
										</button>
									);
								})}
							</div>
						</div>

						<div className="flex justify-end">
							<Button type="button" onClick={goToPromptStep}>
								Preview prompt
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{step === "prompt" && (
				<Card>
					<CardHeader>
						<CardTitle>2. Preview prompt</CardTitle>
						<CardDescription>
							Edit the prompt before running the search.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Textarea
							value={promptText}
							onChange={(event) => setPromptText(event.target.value)}
							rows={8}
							className="font-mono text-sm"
						/>
						<div className="flex justify-between">
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("scope")}
							>
								Back
							</Button>
							<Button
								type="button"
								onClick={() => runLookup.mutate()}
								disabled={runLookup.isPending}
							>
								{runLookup.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Run search
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{step === "results" && (
				<Card>
					<CardHeader>
						<CardTitle>3. Review &amp; apply</CardTitle>
						<CardDescription>
							Edit prices, ignore rows you don&apos;t trust, then save.
							Accepted prices apply to every matched station in{" "}
							{regionLabel || "the selected region"}.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Brand</TableHead>
									<TableHead>Fuel</TableHead>
									<TableHead className="text-right">
										Current avg
									</TableHead>
									<TableHead className="text-right">
										AI price
									</TableHead>
									<TableHead>Confidence</TableHead>
									<TableHead>Source</TableHead>
									<TableHead className="text-right">Accept</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.key}>
										<TableCell className="font-medium">
											{row.brand}
											{!row.matchedBrandId && (
												<Badge
													variant="outline"
													className="ml-2 border-warning text-warning"
												>
													no match
												</Badge>
											)}
										</TableCell>
										<TableCell>{row.fuelType}</TableCell>
										<TableCell className="text-right tabular-nums text-muted-foreground">
											{row.currentAvg !== null
												? `₱${row.currentAvg.toFixed(2)}`
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											<Input
												value={row.priceInput}
												inputMode="decimal"
												className="ml-auto w-24 text-right"
												onChange={(event) =>
													setRows((prev) =>
														prev.map((item) =>
															item.key === row.key
																? {
																		...item,
																		priceInput:
																			event.target
																				.value,
																	}
																: item,
														),
													)
												}
											/>
										</TableCell>
										<TableCell>
											<Badge
												variant={
													confidenceVariant[row.confidence]
												}
											>
												{row.confidence}
											</Badge>
										</TableCell>
										<TableCell className="max-w-[180px] truncate">
											{row.source ? (
												<a
													href={row.source}
													target="_blank"
													rel="noopener noreferrer"
													className="inline-flex items-center gap-1 text-primary hover:underline"
												>
													<span className="truncate">
														{row.asOf || "source"}
													</span>
													<ExternalLink className="h-3 w-3 shrink-0" />
												</a>
											) : (
												"—"
											)}
										</TableCell>
										<TableCell className="text-right">
											<Switch
												checked={row.accepted}
												disabled={!row.matchedBrandId}
												onCheckedChange={(checked) =>
													setRows((prev) =>
														prev.map((item) =>
															item.key === row.key
																? {
																		...item,
																		accepted: checked,
																	}
																: item,
														),
													)
												}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>

						<div className="flex items-center justify-between">
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("prompt")}
							>
								Back
							</Button>
							<div className="flex items-center gap-3">
								<span className="text-sm text-muted-foreground">
									{acceptedCount} accepted
								</span>
								<Button
									type="button"
									onClick={() => save.mutate()}
									disabled={save.isPending || acceptedCount === 0}
								>
									{save.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Apply prices
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

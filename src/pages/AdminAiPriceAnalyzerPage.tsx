import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ImageUp,
	Loader2,
	ScanText,
	ShieldAlert,
	X,
} from "lucide-react";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

type Step = "input" | "review" | "target";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ExtractedResult {
	fuelType: string;
	price: number | null;
	confidence: "high" | "medium" | "low";
}

interface ReviewRow {
	fuelType: FuelType;
	priceInput: string;
	confidence: "high" | "medium" | "low";
	accepted: boolean;
}

const confidenceVariant: Record<
	ReviewRow["confidence"],
	"default" | "secondary" | "outline"
> = {
	high: "default",
	medium: "secondary",
	low: "outline",
};

export default function AdminAiPriceAnalyzerPage() {
	const queryClient = useQueryClient();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const { data: brandLogos = [] } = useStationBrandLogos();
	const { data: stations = [] } = useAdminStations();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<Step>("input");
	const [imageBase64, setImageBase64] = useState<string | null>(null);
	const [imageMime, setImageMime] = useState<string | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [textInput, setTextInput] = useState("");
	const [rows, setRows] = useState<ReviewRow[]>([]);

	const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
	const [stationSearch, setStationSearch] = useState("");
	const [targetStationIds, setTargetStationIds] = useState<string[]>([]);

	const activeBrands = useMemo(
		() => brandLogos.filter((brand) => brand.isActive),
		[brandLogos],
	);

	// Stations matching the chosen brand + free-text location/name search.
	const candidateStations = useMemo(() => {
		const query = stationSearch.trim().toLowerCase();
		return stations.filter((station) => {
			if (selectedBrandId) {
				const matched = resolveStationBrandLogo(
					{
						name: station.name,
						stationBrandLogoId: station.station_brand_logo_id,
					},
					brandLogos,
				);
				if (matched?.id !== selectedBrandId) return false;
			}
			if (!query) return true;
			const haystack =
				`${station.name} ${station.address ?? ""}`.toLowerCase();
			return haystack.includes(query);
		});
	}, [stations, brandLogos, selectedBrandId, stationSearch]);

	const selectedStations = useMemo(
		() => stations.filter((station) => targetStationIds.includes(station.id)),
		[stations, targetStationIds],
	);

	function toggleStation(id: string) {
		setTargetStationIds((prev) =>
			prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
		);
	}

	function resetWizard() {
		setStep("input");
		setImageBase64(null);
		setImageMime(null);
		setImagePreview(null);
		setTextInput("");
		setRows([]);
		setSelectedBrandId(null);
		setStationSearch("");
		setTargetStationIds([]);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	function handleFile(file: File) {
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}
		if (file.size > MAX_IMAGE_BYTES) {
			toast.error("Image too large (max 5 MB)");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = String(reader.result);
			const base64 = dataUrl.split(",")[1] ?? "";
			setImageBase64(base64);
			setImageMime(file.type);
			setImagePreview(dataUrl);
		};
		reader.onerror = () => toast.error("Failed to read image");
		reader.readAsDataURL(file);
	}

	function clearImage() {
		setImageBase64(null);
		setImageMime(null);
		setImagePreview(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	const extract = useMutation({
		mutationFn: async () => {
			const { data, error } = await supabase.functions.invoke(
				"ai-extract-fuel-prices",
				{
					body: {
						imageBase64: imageBase64 ?? undefined,
						mimeType: imageMime ?? undefined,
						text: textInput.trim() || undefined,
					},
				},
			);
			if (error) throw error;
			return data as {
				brandGuess: string | null;
				results: ExtractedResult[];
			};
		},
		onSuccess: ({ brandGuess, results }) => {
			const byType = new Map(
				results
					.filter((result) =>
						fuelTypes.includes(result.fuelType as FuelType),
					)
					.map((result) => [result.fuelType as FuelType, result]),
			);

			const mapped: ReviewRow[] = fuelTypes
				.filter((fuelType) => byType.has(fuelType))
				.map((fuelType) => {
					const result = byType.get(fuelType)!;
					return {
						fuelType,
						priceInput:
							result.price !== null ? String(result.price) : "",
						confidence: result.confidence,
						accepted: result.price !== null,
					};
				});

			if (mapped.length === 0) {
				toast.warning("No fuel prices detected");
				return;
			}

			// Pre-select brand from the model's guess, if it resolves.
			if (brandGuess) {
				const matched = resolveStationBrandLogo(
					{ name: brandGuess },
					brandLogos,
				);
				if (matched) setSelectedBrandId(matched.id);
			}

			setRows(mapped);
			setStep("review");
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const acceptedRows = useMemo(
		() =>
			rows.filter(
				(row) =>
					row.accepted && Number.parseFloat(row.priceInput) > 0,
			),
		[rows],
	);

	const save = useMutation({
		mutationFn: async () => {
			if (targetStationIds.length === 0) {
				throw new Error("Select at least one target station");
			}
			const prices: Record<string, number> = {};
			for (const row of acceptedRows) {
				const price = Number.parseFloat(row.priceInput);
				if (Number.isFinite(price) && price > 0) {
					prices[row.fuelType] = Number(price.toFixed(2));
				}
			}
			if (Object.keys(prices).length === 0) {
				throw new Error("No accepted prices to save");
			}

			const updates = targetStationIds.map((station_id) => ({
				station_id,
				prices,
			}));

			const { data, error } = await supabase.rpc("apply_ai_fuel_prices", {
				_updates: updates,
			});
			if (error) throw error;
			return data as number;
		},
		onSuccess: async (updatedCount) => {
			await refreshAdminData(queryClient);
			toast.success(`Updated ${updatedCount} station(s)`);
			resetWizard();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	function updateRow(fuelType: FuelType, patch: Partial<ReviewRow>) {
		setRows((prev) =>
			prev.map((row) =>
				row.fuelType === fuelType ? { ...row, ...patch } : row,
			),
		);
	}

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
							The AI price analyzer is only available to super admins.
						</p>
					</div>
				</div>
			</div>
		);
	}

	const canExtract = Boolean(imageBase64) || textInput.trim().length > 0;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center gap-3">
				<ScanText className="h-5 w-5 text-primary" />
				<div>
					<h2 className="text-headline text-foreground">
						AI Fuel Price Analyzer
					</h2>
					<p className="text-sm text-muted-foreground">
						Post a price board photo or text, review the extracted prices,
						then apply them to a station.
					</p>
				</div>
			</div>

			{step === "input" && (
				<Card>
					<CardHeader>
						<CardTitle>1. Post image or text</CardTitle>
						<CardDescription>
							Upload a photo of the price board and/or paste the prices
							as text.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						<div className="flex flex-col gap-2">
							<Label>Image</Label>
							{imagePreview ? (
								<div className="relative w-fit">
									<img
										src={imagePreview}
										alt="Price board preview"
										className="max-h-64 rounded-lg border border-border"
									/>
									<Button
										type="button"
										variant="secondary"
										size="icon"
										className="absolute right-2 top-2 h-7 w-7"
										onClick={clearImage}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-6 py-10 text-sm text-muted-foreground transition-colors hover:text-foreground"
								>
									<ImageUp className="h-6 w-6" />
									Click to upload an image (max 5 MB)
								</button>
							)}
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) handleFile(file);
								}}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="price-text">Text</Label>
							<Textarea
								id="price-text"
								value={textInput}
								onChange={(event) => setTextInput(event.target.value)}
								rows={5}
								placeholder={"e.g. Diesel 52.10\nUnleaded 58.45\nPremium 61.20"}
							/>
						</div>

						<div className="flex justify-end">
							<Button
								type="button"
								onClick={() => extract.mutate()}
								disabled={!canExtract || extract.isPending}
							>
								{extract.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Extract prices
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{step === "review" && (
				<Card>
					<CardHeader>
						<CardTitle>2. Review &amp; approve</CardTitle>
						<CardDescription>
							Edit any price and toggle off the ones you don&apos;t want
							to apply.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Fuel</TableHead>
									<TableHead className="text-right">Price</TableHead>
									<TableHead>Confidence</TableHead>
									<TableHead className="text-right">Approve</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.fuelType}>
										<TableCell className="font-medium">
											{row.fuelType}
										</TableCell>
										<TableCell className="text-right">
											<Input
												value={row.priceInput}
												inputMode="decimal"
												className="ml-auto w-24 text-right"
												onChange={(event) =>
													updateRow(row.fuelType, {
														priceInput: event.target.value,
													})
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
										<TableCell className="text-right">
											<Switch
												checked={row.accepted}
												onCheckedChange={(checked) =>
													updateRow(row.fuelType, {
														accepted: checked,
													})
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
								onClick={() => setStep("input")}
							>
								Back
							</Button>
							<div className="flex items-center gap-3">
								<span className="text-sm text-muted-foreground">
									{acceptedRows.length} approved
								</span>
								<Button
									type="button"
									onClick={() => setStep("target")}
									disabled={acceptedRows.length === 0}
								>
									Continue
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{step === "target" && (
				<Card>
					<CardHeader>
						<CardTitle>3. Select brand &amp; station</CardTitle>
						<CardDescription>
							Pick the brand and the station these prices belong to,
							then save.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						<div className="flex flex-col gap-2">
							<Label>Brand</Label>
							<div className="flex flex-wrap gap-2">
								{activeBrands.map((brand) => {
									const checked = selectedBrandId === brand.id;
									return (
										<button
											key={brand.id}
											type="button"
											onClick={() => {
												setSelectedBrandId(
													checked ? null : brand.id,
												);
												setTargetStationIds([]);
											}}
											className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
												checked
													? "border-primary bg-primary text-primary-foreground"
													: "border-border bg-background text-muted-foreground hover:text-foreground"
											}`}
										>
											{checked && <Check className="h-4 w-4" />}
											{brand.brandName}
										</button>
									);
								})}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="station-search">Stations</Label>
							<Input
								id="station-search"
								value={stationSearch}
								onChange={(event) =>
									setStationSearch(event.target.value)
								}
								placeholder="Search by name or address"
							/>
							<div className="max-h-72 overflow-y-auto rounded-lg border border-border">
								{candidateStations.length === 0 ? (
									<p className="p-4 text-sm text-muted-foreground">
										No matching stations.
									</p>
								) : (
									candidateStations.slice(0, 50).map((station) => (
										<StationOption
											key={station.id}
											station={station}
											selected={targetStationIds.includes(
												station.id,
											)}
											onSelect={() =>
												toggleStation(station.id)
											}
										/>
									))
								)}
							</div>
							{candidateStations.length > 50 && (
								<p className="text-xs text-muted-foreground">
									Showing first 50 — refine your search.
								</p>
							)}
						</div>

						{selectedStations.length > 0 && (
							<div className="flex flex-col gap-2">
								<Label>
									Selected stations ({selectedStations.length})
								</Label>
								<div className="flex flex-wrap gap-2">
									{selectedStations.map((station) => (
										<span
											key={station.id}
											className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm text-foreground"
										>
											<span className="max-w-[180px] truncate">
												{station.name}
											</span>
											<button
												type="button"
												onClick={() =>
													toggleStation(station.id)
												}
												className="text-muted-foreground hover:text-foreground"
												aria-label={`Remove ${station.name}`}
											>
												<X className="h-3.5 w-3.5" />
											</button>
										</span>
									))}
								</div>
							</div>
						)}

						<div className="flex items-center justify-between">
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("review")}
							>
								Back
							</Button>
							<div className="flex items-center gap-3">
								<span className="text-sm text-muted-foreground">
									{selectedStations.length} selected
								</span>
								<Button
									type="button"
									onClick={() => save.mutate()}
									disabled={
										save.isPending ||
										targetStationIds.length === 0
									}
								>
									{save.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Save prices
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function StationOption({
	station,
	selected,
	onSelect,
}: {
	station: GasStationRow;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 ${
				selected
					? "bg-primary/10 text-foreground"
					: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
			}`}
		>
			<span className="flex flex-col">
				<span className="font-medium text-foreground">{station.name}</span>
				{station.address && (
					<span className="truncate text-xs text-muted-foreground">
						{station.address}
					</span>
				)}
			</span>
			{selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
		</button>
	);
}

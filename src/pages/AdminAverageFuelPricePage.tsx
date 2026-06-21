import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { fuelTypes, fuelTypeTextColorClassNames } from "@/lib/fuel-prices";
import { useUserAccess } from "@/hooks/useUserAccess";
import type { FuelType } from "@/types/station";

type Field = "avg" | "min" | "max";
type PriceEntry = Record<Field, string>;
type PriceFormMap = Record<FuelType, PriceEntry>;

type WizardStep = "edit" | "review";

// Maps JSON keys (incl. the snake_case format the user pastes) to fuel types.
const JSON_KEY_TO_FUEL_TYPE: Record<string, FuelType> = {
	unleaded: "Unleaded",
	premium: "Premium",
	premium_unleaded: "Premium",
	"premium unleaded": "Premium",
	diesel: "Diesel",
	premium_diesel: "Premium Diesel",
	"premium diesel": "Premium Diesel",
	kerosene: "Kerosene",
};

function emptyEntry(): PriceEntry {
	return { avg: "", min: "", max: "" };
}

function emptyForm(): PriceFormMap {
	return fuelTypes.reduce((acc, fuelType) => {
		acc[fuelType] = emptyEntry();
		return acc;
	}, {} as PriceFormMap);
}

interface ManualAveragePriceRow {
	fuel_type: string;
	avg_price: number | null;
	min_price: number | null;
	max_price: number | null;
	updated_at: string;
}

function parseField(value: string): number | null {
	const raw = value.trim();
	if (raw === "") return null;
	const num = Number.parseFloat(raw);
	return Number.isFinite(num) ? num : NaN;
}

export default function AdminAverageFuelPricePage() {
	const queryClient = useQueryClient();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const [step, setStep] = useState<WizardStep>("edit");
	const [form, setForm] = useState<PriceFormMap>(emptyForm);
	const [jsonText, setJsonText] = useState("");

	const overridesQuery = useQuery({
		queryKey: ["manual_average_fuel_prices"],
		queryFn: async () => {
			const { data, error } = await supabase.rpc(
				"get_manual_average_fuel_prices",
			);
			if (error) throw error;
			return (data ?? []) as ManualAveragePriceRow[];
		},
		enabled: isSuperAdmin,
	});

	// Hydrate the form once overrides load.
	useEffect(() => {
		if (!overridesQuery.data) return;
		const next = emptyForm();
		for (const row of overridesQuery.data) {
			if (!fuelTypes.includes(row.fuel_type as FuelType)) continue;
			const entry = next[row.fuel_type as FuelType];
			entry.avg = row.avg_price !== null ? String(row.avg_price) : "";
			entry.min = row.min_price !== null ? String(row.min_price) : "";
			entry.max = row.max_price !== null ? String(row.max_price) : "";
		}
		setForm(next);
	}, [overridesQuery.data]);

	const lastUpdated = useMemo(() => {
		const stamps = (overridesQuery.data ?? [])
			.map((row) => row.updated_at)
			.sort();
		return stamps.length ? stamps[stamps.length - 1] : null;
	}, [overridesQuery.data]);

	function setField(fuelType: FuelType, field: Field, value: string) {
		setForm((prev) => ({
			...prev,
			[fuelType]: { ...prev[fuelType], [field]: value },
		}));
	}

	function clearAll() {
		setForm(emptyForm());
	}

	function applyJson() {
		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonText);
		} catch {
			toast.error("Invalid JSON");
			return;
		}
		if (typeof parsed !== "object" || parsed === null) {
			toast.error("JSON must be an object");
			return;
		}

		const next = emptyForm();
		let matched = 0;
		for (const [key, raw] of Object.entries(
			parsed as Record<string, unknown>,
		)) {
			const fuelType = JSON_KEY_TO_FUEL_TYPE[key.trim().toLowerCase()];
			if (!fuelType || typeof raw !== "object" || raw === null) continue;
			const obj = raw as Record<string, unknown>;
			const entry = next[fuelType];
			if (obj.avg != null) entry.avg = String(obj.avg);
			if (obj.min != null) entry.min = String(obj.min);
			if (obj.max != null) entry.max = String(obj.max);
			matched += 1;
		}

		if (matched === 0) {
			toast.error("No recognized fuel types in JSON");
			return;
		}
		setForm(next);
		toast.success(`Loaded ${matched} fuel type(s) from JSON`);
	}

	// Validate + build payload. Throws on bad input.
	function buildPayload(): Record<string, unknown> {
		const payload: Record<string, unknown> = {};
		for (const fuelType of fuelTypes) {
			const entry = form[fuelType];
			const avg = parseField(entry.avg);
			const min = parseField(entry.min);
			const max = parseField(entry.max);

			if (Number.isNaN(avg) || Number.isNaN(min) || Number.isNaN(max)) {
				throw new Error(`Invalid number for ${fuelType}`);
			}
			// No average → clear this override.
			if (avg === null) {
				payload[fuelType] = null;
				continue;
			}
			if (avg <= 0) throw new Error(`${fuelType} average must be > 0`);
			if (min !== null && max !== null && min > max) {
				throw new Error(`${fuelType} min exceeds max`);
			}
			payload[fuelType] = {
				avg: Number(avg.toFixed(2)),
				min: min === null ? null : Number(min.toFixed(2)),
				max: max === null ? null : Number(max.toFixed(2)),
			};
		}
		return payload;
	}

	function goToReview() {
		try {
			buildPayload();
			setStep("review");
		} catch (error) {
			toast.error((error as Error).message);
		}
	}

	const save = useMutation({
		mutationFn: async () => {
			const payload = buildPayload();
			const { data, error } = await supabase.rpc(
				"set_manual_average_fuel_prices",
				{ _prices: payload },
			);
			if (error) throw error;
			return data as number;
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["manual_average_fuel_prices"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["public_station_summary"],
				}),
			]);
			toast.success("Average prices updated");
			setStep("edit");
		},
		onError: (error: Error) => toast.error(error.message),
	});

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
							Average fuel price overrides are only available to
							super admins.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center gap-3">
				<Gauge className="h-5 w-5 text-primary" />
				<div>
					<h2 className="text-headline text-foreground">
						Average Fuel Price
					</h2>
					<p className="text-sm text-muted-foreground">
						Set the average, min, and max price shown on the homepage
						for each fuel type. Leave the average blank to fall back
						to the crowd-sourced average.
					</p>
				</div>
			</div>

			{step === "edit" && (
				<>
					<Card>
						<CardHeader>
							<CardTitle>1. Enter prices</CardTitle>
							<CardDescription>
								Type values directly, or paste JSON below.
								{lastUpdated && (
									<>
										{" "}
										Last updated{" "}
										{new Date(
											lastUpdated,
										).toLocaleString()}
										.
									</>
								)}
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Fuel type</TableHead>
										<TableHead className="text-right">
											Average
										</TableHead>
										<TableHead className="text-right">
											Min
										</TableHead>
										<TableHead className="text-right">
											Max
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{fuelTypes.map((fuelType) => (
										<TableRow key={fuelType}>
											<TableCell
												className={`font-semibold ${fuelTypeTextColorClassNames[fuelType]}`}
											>
												{fuelType}
											</TableCell>
											{(
												["avg", "min", "max"] as Field[]
											).map((field) => (
												<TableCell
													key={field}
													className="text-right"
												>
													<Input
														value={
															form[fuelType][
																field
															]
														}
														inputMode="decimal"
														placeholder="—"
														aria-label={`${fuelType} ${field}`}
														className="ml-auto w-24 text-right tabular-nums"
														onChange={(event) =>
															setField(
																fuelType,
																field,
																event.target
																	.value,
															)
														}
													/>
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>

							<div className="flex flex-col gap-2">
								<Label htmlFor="json-input">
									Paste JSON (optional)
								</Label>
								<Textarea
									id="json-input"
									value={jsonText}
									onChange={(event) =>
										setJsonText(event.target.value)
									}
									rows={8}
									placeholder={
										'{\n  "diesel": { "avg": 81.13, "min": 72, "max": 90 },\n  "premium_unleaded": { "avg": 89.51, "min": 82, "max": 99 }\n}'
									}
									className="font-mono text-sm"
								/>
								<div className="flex justify-end">
									<Button
										type="button"
										variant="secondary"
										onClick={applyJson}
										disabled={!jsonText.trim()}
									>
										Apply JSON to fields
									</Button>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<Button
									type="button"
									variant="outline"
									onClick={clearAll}
								>
									Clear all
								</Button>
								<Button
									type="button"
									onClick={goToReview}
									disabled={overridesQuery.isLoading}
								>
									Review
								</Button>
							</div>
						</CardContent>
					</Card>
				</>
			)}

			{step === "review" && (
				<Card>
					<CardHeader>
						<CardTitle>2. Double-check values</CardTitle>
						<CardDescription>
							These values will replace the homepage averages
							immediately after saving. Blank averages clear the
							override and fall back to crowd-sourced data.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Fuel type</TableHead>
									<TableHead className="text-right">
										Average
									</TableHead>
									<TableHead className="text-right">
										Min
									</TableHead>
									<TableHead className="text-right">
										Max
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{fuelTypes.map((fuelType) => {
									const entry = form[fuelType];
									const fmt = (value: string) => {
										const num = parseField(value);
										return num === null || Number.isNaN(num)
											? "—"
											: `₱${num.toFixed(2)}`;
									};
									const cleared =
										parseField(entry.avg) === null;
									return (
										<TableRow key={fuelType}>
											<TableCell
												className={`font-semibold ${fuelTypeTextColorClassNames[fuelType]}`}
											>
												{fuelType}
												{cleared && (
													<span className="ml-2 text-xs font-normal text-muted-foreground">
														(cleared)
													</span>
												)}
											</TableCell>
											<TableCell className="text-right text-lg font-bold tabular-nums">
												{fmt(entry.avg)}
											</TableCell>
											<TableCell className="text-right tabular-nums text-muted-foreground">
												{fmt(entry.min)}
											</TableCell>
											<TableCell className="text-right tabular-nums text-muted-foreground">
												{fmt(entry.max)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>

						<div className="flex items-center justify-between">
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("edit")}
								disabled={save.isPending}
							>
								Back
							</Button>
							<Button
								type="button"
								onClick={() => save.mutate()}
								disabled={save.isPending}
							>
								{save.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Save averages
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Loader2,
	Pencil,
	Plus,
	Save,
	Search,
	Trash2,
	X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { StationLocationPicker } from "@/components/StationLocationPicker";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import type { FuelType, StationStatus } from "@/types/station";
import {
	buildStationPayload,
	type GasStationRow,
	initialStationForm,
	type StationFormState,
	normalizeStationPricesForForm,
	refreshAdminData,
	useAdminStations,
	fuelTypes,
} from "@/components/admin/admin-shared";

export default function AdminStationsPage() {
	const queryClient = useQueryClient();
	const { data: stations = [], isLoading: stationsLoading } =
		useAdminStations();
	const [showStationForm, setShowStationForm] = useState(false);
	const [editingStationId, setEditingStationId] = useState<string | null>(
		null,
	);
	const [stationForm, setStationForm] =
		useState<StationFormState>(initialStationForm);
	const [stationSearch, setStationSearch] = useState("");

	const filteredStations = useMemo(() => {
		const query = stationSearch.trim().toLowerCase();
		if (!query) return stations;

		return stations.filter((station) => {
			return (
				station.name.toLowerCase().includes(query) ||
				station.address.toLowerCase().includes(query)
			);
		});
	}, [stationSearch, stations]);

	const resetStationEditor = () => {
		setEditingStationId(null);
		setStationForm(initialStationForm);
		setShowStationForm(false);
	};

	const beginCreateStation = () => {
		setEditingStationId(null);
		setStationForm(initialStationForm);
		setShowStationForm(true);
	};

	const beginEditStation = (station: GasStationRow) => {
		setEditingStationId(station.id);
		setStationForm({
			name: station.name,
			address: station.address,
			lat: String(station.lat),
			lng: String(station.lng),
			prices: normalizeStationPricesForForm(
				station.prices,
				station.fuel_type as FuelType,
				Number(station.price_per_liter) || 0,
			),
			fuelType: station.fuel_type as FuelType,
			status: station.status as StationStatus,
		});
		setShowStationForm(true);
	};

	const saveStation = useMutation({
		mutationFn: async () => {
			const payload = buildStationPayload(stationForm);

			if (editingStationId) {
				const { error } = await supabase
					.from("gas_stations")
					.update(payload)
					.eq("id", editingStationId);

				if (error) throw error;
				return "updated" as const;
			}

			const { error } = await supabase.from("gas_stations").insert({
				...payload,
				report_count: 0,
			});

			if (error) throw error;
			return "created" as const;
		},
		onSuccess: async (mode) => {
			await refreshAdminData(queryClient);
			toast.success(
				mode === "created" ? "Station created" : "Station updated",
			);
			resetStationEditor();
		},
		onError: (error) => toast.error(error.message),
	});

	const deleteStation = useMutation({
		mutationFn: async (stationId: string) => {
			const { error } = await supabase
				.from("gas_stations")
				.delete()
				.eq("id", stationId);
			if (error) throw error;
		},
		onSuccess: async () => {
			await refreshAdminData(queryClient);
			toast.success("Station deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						Fuel Stations
					</h3>
					<p className="text-sm text-muted-foreground">
						Create, update, and remove station records.
					</p>
				</div>
				<div className="flex flex-col gap-2 md:flex-row">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search stations"
							value={stationSearch}
							onChange={(event) =>
								setStationSearch(event.target.value)
							}
							className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
						/>
					</div>
					<button
						onClick={
							showStationForm ? resetStationEditor : beginCreateStation
						}
						className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
					>
						{showStationForm ? (
							<X className="h-4 w-4" />
						) : (
							<Plus className="h-4 w-4" />
						)}
						{showStationForm ? "Cancel" : "Add Station"}
					</button>
				</div>
			</div>

			<AnimatePresence initial={false}>
				{showStationForm && (
					<motion.form
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						onSubmit={(event) => {
							event.preventDefault();
							saveStation.mutate();
						}}
						className="mb-5 overflow-hidden"
					>
						<div className="grid gap-3 rounded-xl bg-muted p-4 md:grid-cols-2">
							<input
								type="text"
								placeholder="Station name"
								value={stationForm.name}
								onChange={(event) =>
									setStationForm((current) => ({
										...current,
										name: event.target.value,
									}))
								}
								className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
							/>
							<input
								type="text"
								placeholder="Address"
								value={stationForm.address}
								onChange={(event) =>
									setStationForm((current) => ({
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
								value={stationForm.lat}
								onChange={(event) =>
									setStationForm((current) => ({
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
								value={stationForm.lng}
								onChange={(event) =>
									setStationForm((current) => ({
										...current,
										lng: event.target.value,
									}))
								}
								className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
							/>
							<StationLocationPicker
								value={{
									lat: stationForm.lat,
									lng: stationForm.lng,
								}}
								onChange={(coords) =>
									setStationForm((current) => ({
										...current,
										lat: coords.lat,
										lng: coords.lng,
									}))
								}
								onAddressResolved={(address) =>
									setStationForm((current) => ({
										...current,
										address,
									}))
								}
								existingStations={stations.map((station) => ({
									lat: station.lat,
									lng: station.lng,
								}))}
							/>
							<select
								value={stationForm.fuelType}
								onChange={(event) =>
									setStationForm((current) => ({
										...current,
										fuelType: event.target.value as FuelType,
									}))
								}
								className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							>
								<option value="Diesel">Diesel</option>
								<option value="Unleaded">Unleaded</option>
								<option value="Premium">Premium</option>
							</select>
							<select
								value={stationForm.status}
								onChange={(event) =>
									setStationForm((current) => ({
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
								<div className="mb-3 flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-foreground">
											Fuel Prices
										</p>
										<p className="text-xs text-muted-foreground">
											Add each available fuel price. The
											selected fuel type becomes the main
											displayed price.
										</p>
									</div>
									<span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
										Primary: <b>{stationForm.fuelType}</b>
									</span>
								</div>
								<div className="grid gap-3 md:grid-cols-3">
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
												value={stationForm.prices[fuelType]}
												onChange={(event) =>
													setStationForm((current) => ({
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
									{stationForm.prices[stationForm.fuelType]
										? `₱${Number(stationForm.prices[stationForm.fuelType]).toFixed(2)}`
										: "Set a price for the selected fuel type"}
								</p>
							</div>
							<div></div>
							<button
								type="submit"
								disabled={saveStation.isPending}
								className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
							>
								{saveStation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4" />
								)}
								{editingStationId ? "Save Station" : "Create Station"}
							</button>
						</div>
					</motion.form>
				)}
			</AnimatePresence>

			<div className="flex flex-col gap-3">
				{stationsLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : filteredStations.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No stations found.
					</p>
				) : (
					filteredStations.map((station) => (
						<div
							key={station.id}
							className="rounded-xl border border-border bg-secondary/40 p-4"
						>
							<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-semibold text-foreground">
											{station.name}
										</p>
										{station.is_verified && (
											<VerifiedStationBadge className="py-0.5" />
										)}
										<StatusBadge
											status={station.status as StationStatus}
										/>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{station.address}
									</p>
									<p className="mt-2 text-sm text-muted-foreground">
										{station.fuel_type} • ₱
										{Number(station.price_per_liter).toFixed(2)} •{" "}
										{station.report_count} reports
									</p>
									<p className="text-xs text-muted-foreground">
										{station.lat.toFixed(5)}, {station.lng.toFixed(5)}
									</p>
								</div>

								<div className="flex gap-2">
									<button
										onClick={() => beginEditStation(station)}
										className="flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
									>
										<Pencil className="h-4 w-4" />
										Edit
									</button>
									<button
										onClick={() => {
											if (
												window.confirm(`Delete ${station.name}?`)
											) {
												deleteStation.mutate(station.id);
											}
										}}
										disabled={deleteStation.isPending}
										className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
									>
										<Trash2 className="h-4 w-4" />
										Delete
									</button>
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

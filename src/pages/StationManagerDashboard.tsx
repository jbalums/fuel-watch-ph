import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
	ChevronRight,
	Loader2,
	MapPin,
	Save,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { toast } from "@/lib/app-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
	useManagedStations,
	useReleaseManagedStation,
} from "@/hooks/useManagedStation";
import { supabase } from "@/integrations/supabase/client";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	createEmptyFuelAvailabilityFormMap,
	createEmptyFuelPriceFormMap,
	deriveFuelAvailabilityFromPrices,
	fuelTypes,
	fuelTypeBorderColorClassNames,
	fuelTypeTextColorClassNames,
	getFuelSummarySelection,
	parseFuelAvailabilityForm,
	parseFuelPriceForm,
	validateFuelPriceAvailability,
	type FuelAvailabilityFormMap,
} from "@/lib/fuel-prices";

type StationPricesFormState = Record<(typeof fuelTypes)[number], string>;
type StationAvailabilityFormState = FuelAvailabilityFormMap;

function normalizePrices(
	prices: Record<FuelType, number | null>,
): StationPricesFormState {
	return fuelTypes.reduce((formattedPrices, fuelType) => {
		const price = prices[fuelType];
		formattedPrices[fuelType] =
			typeof price === "number" && price > 0 ? price.toFixed(2) : "";
		return formattedPrices;
	}, createEmptyFuelPriceFormMap());
}

function normalizeAvailability(
	availability: Record<FuelType, "Available" | "Low" | "Out" | null>,
): StationAvailabilityFormState {
	return fuelTypes.reduce((formattedAvailability, fuelType) => {
		formattedAvailability[fuelType] = availability[fuelType] ?? "";
		return formattedAvailability;
	}, createEmptyFuelAvailabilityFormMap());
}

export default function StationManagerDashboard() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user, loading: authLoading } = useAuth();
	const { data: stations = [], isLoading } = useManagedStations();
	const releaseManagedStation = useReleaseManagedStation();
	const [selectedStationId, setSelectedStationId] = useState<string | null>(
		null,
	);
	const [stationName, setStationName] = useState("");
	const [address, setAddress] = useState("");
	const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
	const [prices, setPrices] = useState<StationPricesFormState>(
		createEmptyFuelPriceFormMap(),
	);
	const [fuelAvailability, setFuelAvailability] =
		useState<StationAvailabilityFormState>(
			createEmptyFuelAvailabilityFormMap(),
		);
	const station =
		selectedStationId === null
			? null
			: (stations.find(
					(candidate) => candidate.id === selectedStationId,
				) ?? null);

	useEffect(() => {
		if (authLoading) {
			return;
		}

		if (!user) {
			navigate("/auth");
		}
	}, [authLoading, navigate, user]);

	useEffect(() => {
		if (stations.length === 0) {
			setSelectedStationId(null);
			return;
		}

		setSelectedStationId((current) => {
			if (
				current &&
				stations.some((candidate) => candidate.id === current)
			) {
				return current;
			}

			return null;
		});
	}, [stations]);

	useEffect(() => {
		if (!station) {
			setStationName("");
			setAddress("");
			setPrices(createEmptyFuelPriceFormMap());
			setFuelAvailability(createEmptyFuelAvailabilityFormMap());
			return;
		}

		setStationName(station.name);
		setAddress(station.address);
		setPrices(normalizePrices(station.prices));
		setFuelAvailability(normalizeAvailability(station.fuelAvailability));
	}, [station]);

	const saveStationDetails = useMutation({
		mutationFn: async () => {
			if (!station) {
				throw new Error("No managed station found");
			}

			if (!address.trim()) {
				throw new Error("Station address is required");
			}

			if (!stationName.trim()) {
				throw new Error("Station name is required");
			}

			const { error } = await supabase.rpc(
				"update_managed_station_details",
				{
					_station_id: station.id,
					_name: stationName.trim(),
					_address: address.trim(),
				},
			);

			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["managed_station"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["managed_stations"],
				}),
				queryClient.invalidateQueries({ queryKey: ["gas_stations"] }),
				queryClient.invalidateQueries({
					queryKey: ["admin", "gas_stations"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["public_station_browse"],
				}),
			]);
			toast.success("Station details updated");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const saveStationPrices = useMutation({
		mutationFn: async () => {
			if (!station) {
				throw new Error("No managed station found");
			}

			const payload = parseFuelPriceForm(prices);
			const normalizedAvailability = deriveFuelAvailabilityFromPrices(
				payload,
				parseFuelAvailabilityForm(fuelAvailability),
			);
			validateFuelPriceAvailability(payload, normalizedAvailability);
			const summarySelection = getFuelSummarySelection(
				payload,
				normalizedAvailability,
				station.fuelType,
			);

			if (!summarySelection) {
				throw new Error("Add at least one valid fuel price");
			}

			const { error } = await supabase.rpc("update_managed_station", {
				_station_id: station.id,
				_address: address.trim(),
				_fuel_type: summarySelection.fuelType,
				_prices: payload,
				_fuel_availability: normalizedAvailability,
			});

			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["managed_station"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["managed_stations"],
				}),
				queryClient.invalidateQueries({ queryKey: ["gas_stations"] }),
				queryClient.invalidateQueries({
					queryKey: ["admin", "gas_stations"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["public_station_browse"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["public_station_summary"],
				}),
			]);
			toast.success("Fuel prices updated");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const confirmReleaseStation = () => {
		if (!station || releaseManagedStation.isPending) {
			return;
		}

		releaseManagedStation.mutate(station.id, {
			onSuccess: () => {
				toast.success("Station unclaimed successfully");
				setReleaseDialogOpen(false);
				setSelectedStationId(null);
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	};

	if (authLoading || isLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ ease: [0.2, 0.8, 0.2, 1] }}
			className="flex flex-col gap-6 pb-10"
		>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<h2 className="text-headline text-foreground">
						Station Manager Dashboard
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Select one of your approved stations, then manage its
						details and fuel prices.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => navigate("/manager")}
						className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sovereign-ease transition-colors"
					>
						My Station
					</button>
				</div>
			</div>

			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ease: [0.2, 0.8, 0.2, 1] }}
				className="flex flex-col gap-5"
			>
				{stations.length === 0 ? (
					<div className="rounded-2xl bg-card p-6 shadow-sovereign">
						<h2 className="text-lg font-semibold text-foreground">
							No managed stations yet
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							Once one of your station claims is approved by an
							admin, you will be able to manage it here.
						</p>
					</div>
				) : (
					<>
						<div className="rounded-2xl bg-card p-5 shadow-sovereign">
							<div className="mb-4">
								<h3 className="text-xl font-semibold text-foreground">
									My Stations
								</h3>
								<p className="text-sm text-muted-foreground">
									Choose which station you want to manage.
								</p>
							</div>
							<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
								{stations.map((managedStation) => {
									const isSelected =
										managedStation.id === selectedStationId;

									return (
										<button
											key={managedStation.id}
											type="button"
											onClick={() =>
												setSelectedStationId(
													managedStation.id,
												)
											}
											className={`rounded-xl border p-4 text-left sovereign-ease transition-colors ${
												isSelected
													? "border-primary bg-primary/10"
													: "border-border bg-secondary/40 hover:bg-secondary"
											}`}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="font-semibold text-foreground">
														{managedStation.name}
													</p>
													<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
														{managedStation.address}
													</p>
												</div>
												<ChevronRight
													className={`h-4 w-4 shrink-0 ${
														isSelected
															? "text-primary"
															: "text-muted-foreground"
													}`}
												/>
											</div>
											<div className="mt-3 flex flex-wrap items-center gap-2">
												<span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
													<ShieldCheck className="h-3.5 w-3.5" />
													Verified
												</span>
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{!station ? (
							<div className="rounded-2xl bg-card p-6 shadow-sovereign">
								<h3 className="text-lg font-semibold text-foreground">
									Select a station to manage
								</h3>
								<p className="mt-2 text-sm text-muted-foreground">
									Pick one of your stations above to edit its
									address, fuel prices, or claim status.
								</p>
							</div>
						) : (
							<div className="flex  flex-col gap-5">
								<div className="rounded-2xl bg-card p-6 shadow-sovereign">
									<div className="flex flex-wrap items-center gap-3">
										<h2 className="text-headline text-foreground">
											{station.name}
										</h2>
										<span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
											<ShieldCheck className="h-3.5 w-3.5" />
											Verified
										</span>
									</div>
									<div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
										<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
										<span>{station.address}</span>
									</div>
									<p className="mt-2 text-xs text-muted-foreground">
										Coordinates: {station.lat.toFixed(5)},{" "}
										{station.lng.toFixed(5)}
									</p>
								</div>

								<form
									onSubmit={(event) => {
										event.preventDefault();
										saveStationPrices.mutate();
									}}
									className="rounded-2xl bg-card p-6 shadow-sovereign"
								>
									<div className="mb-4">
										<h3 className="text-xl font-semibold text-foreground">
											Update Fuel Station Prices
										</h3>
										<p className="text-sm text-muted-foreground">
											Update fuel prices separately from
											the station details.
										</p>
									</div>

									<div className="rounded-xl border border-border bg-background p-4">
										<div className="mb-3">
											<div>
												<p className="text-sm font-medium text-foreground">
													Fuel Prices
												</p>
												<p className="text-xs text-muted-foreground">
													Update each fuel's price for
													your station. The main
													displayed fuel is derived
													automatically from the fuel
													rows.
												</p>
											</div>
										</div>
										<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
											{fuelTypes.map((type) => (
												<div
													key={type}
													className={`flex flex-col gap-2 rounded border bg-surface-alt/60 p-3 ${fuelTypeBorderColorClassNames[type]}`}
												>
													<label
														className={`text-xs font-semibold ${fuelTypeTextColorClassNames[type]}`}
													>
														{type}
													</label>
													<div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2">
														<div className="min-w-0">
															<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
																Current
															</p>
															<p
																className={`whitespace-nowrap text-sm font-bold ${fuelTypeTextColorClassNames[type]}`}
															>
																{typeof station
																	.prices[
																	type
																] ===
																	"number" &&
																station.prices[
																	type
																] !== null
																	? `₱ ${station.prices[
																			type
																		]?.toFixed(
																			2,
																		)}`
																	: "--.--"}
															</p>
														</div>
														<span className="text-xs font-semibold text-muted-foreground">
															→
														</span>
														<div className="min-w-0 flex-1">
															<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
																New
															</p>
															<input
																type="number"
																step="0.01"
																placeholder="0.00"
																value={
																	prices[type]
																}
																onChange={(
																	event,
																) =>
																	setPrices(
																		(
																			current,
																		) => ({
																			...current,
																			[type]: event
																				.target
																				.value,
																		}),
																	)
																}
																className="min-w-0 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
															/>
														</div>
													</div>
												</div>
											))}
										</div>
										<p className="mt-3 text-xs text-muted-foreground">
											Add prices for the fuels you want to
											update. Blank fields are ignored.
										</p>
									</div>
									<p className="-mb-3 mt-4 text-center text-xs italic">
										Add at least one valid fuel price before
										saving.
									</p>
									<button
										type="submit"
										disabled={saveStationPrices.isPending}
										className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
									>
										{saveStationPrices.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Save className="h-4 w-4" />
										)}
										Save Fuel Prices
									</button>
								</form>
								<form
									onSubmit={(event) => {
										event.preventDefault();
										saveStationDetails.mutate();
									}}
									className="rounded-2xl bg-card p-6 shadow-sovereign"
								>
									<div className="mb-4">
										<h3 className="text-xl font-semibold text-foreground">
											Update Station Details
										</h3>
										<p className="text-sm text-muted-foreground">
											Update the basic public details for
											this station.
										</p>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-medium text-muted-foreground">
												Station Name
											</label>
											<input
												type="text"
												value={stationName}
												onChange={(event) =>
													setStationName(
														event.target.value,
													)
												}
												className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
											/>
										</div>
										<div className="flex flex-col gap-1.5">
											<label className="text-xs font-medium text-muted-foreground">
												Station Address
											</label>
											<input
												type="text"
												value={address}
												onChange={(event) =>
													setAddress(
														event.target.value,
													)
												}
												placeholder="Station address"
												className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
											/>
										</div>
									</div>
									<button
										type="submit"
										disabled={saveStationDetails.isPending}
										className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
									>
										{saveStationDetails.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Save className="h-4 w-4" />
										)}
										Save Station Details
									</button>
								</form>
								<div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-sovereign">
									<h3 className="text-xl font-semibold text-foreground">
										Unclaim Station
									</h3>
									<p className="mt-2 text-sm text-muted-foreground">
										Remove your manager access and verified
										claim for this station. The station
										record will stay listed in FuelWatch PH.
									</p>
									<button
										type="button"
										onClick={() =>
											setReleaseDialogOpen(true)
										}
										disabled={
											releaseManagedStation.isPending
										}
										className="mt-4 inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
									>
										{releaseManagedStation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Trash2 className="h-4 w-4" />
										)}
										Unclaim station
									</button>
								</div>
							</div>
						)}
					</>
				)}
			</motion.div>

			<AlertDialog
				open={releaseDialogOpen}
				onOpenChange={(open) => {
					if (!releaseManagedStation.isPending) {
						setReleaseDialogOpen(open);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Remove your station claim?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove your manager access and verified
							claim for this station. The station itself will
							remain listed in FuelWatch PH.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{station ? (
						<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{station.name}
							</p>
							<p className="mt-1 text-muted-foreground">
								{station.address}
							</p>
						</div>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={releaseManagedStation.isPending}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmReleaseStation}
							disabled={releaseManagedStation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{releaseManagedStation.isPending
								? "Removing..."
								: "Remove My Station"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</motion.div>
	);
}

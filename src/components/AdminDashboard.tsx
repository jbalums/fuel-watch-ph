import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	CheckCircle2,
	FileText,
	Fuel,
	Loader2,
	Pencil,
	Plus,
	Save,
	Search,
	ShieldAlert,
	Trash2,
	X,
	XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { createFuelReportPhotoUrl } from "@/lib/fuel-report-photo-upload";
import {
	getPrimaryFuelPriceSelection,
	normalizeFuelPrices,
} from "@/lib/fuel-prices";
import {
	useAdminStationClaims,
	useApproveStationClaim,
	useRejectStationClaim,
} from "@/hooks/useStationClaims";
import {
	FuelReport,
	FuelReportReviewStatus,
	FuelType,
	StationClaimRequest,
	StationClaimReviewStatus,
	StationStatus,
} from "@/types/station";
import { StatusBadge } from "./StatusBadge";
import { StationLocationPicker } from "./StationLocationPicker";
import { VerifiedStationBadge } from "./VerifiedStationBadge";

type GasStationRow = Tables<"gas_stations">;
type FuelReportRow = Tables<"fuel_reports">;
type AdminSection = "stations" | "reports" | "claims";
type ReportFilter = FuelReportReviewStatus | "all";
type ClaimFilter = StationClaimReviewStatus | "all";
type StationPricesFormState = Record<FuelType, string>;

const fuelTypes: FuelType[] = ["Unleaded", "Premium", "Diesel"];

type StationFormState = {
	name: string;
	address: string;
	lat: string;
	lng: string;
	prices: StationPricesFormState;
	fuelType: FuelType;
	status: StationStatus;
};

const initialStationForm: StationFormState = {
	name: "",
	address: "",
	lat: "",
	lng: "",
	prices: {
		Unleaded: "",
		Premium: "",
		Diesel: "",
	},
	fuelType: "Diesel",
	status: "Available",
};

const reportFilters: { value: ReportFilter; label: string }[] = [
	{ value: "pending", label: "Pending" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
	{ value: "all", label: "All" },
];

const claimFilters: { value: ClaimFilter; label: string }[] = [
	{ value: "pending", label: "Pending" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
	{ value: "all", label: "All" },
];

function mapFuelReport(report: FuelReportRow): FuelReport {
	const prices = normalizeFuelPrices(
		report.prices,
		report.fuel_type as FuelType,
		Number(report.price) || 0,
	);
	const primarySelection =
		getPrimaryFuelPriceSelection(prices) ?? {
			fuelType: report.fuel_type as FuelType,
			price: Number(report.price) || 0,
		};

	return {
		id: report.id,
		stationName: report.station_name,
		lat: report.lat,
		lng: report.lng,
		photoPath: report.photo_path,
		photoFilename: report.photo_filename,
		photoUrl: null,
		prices,
		price: primarySelection.price,
		fuelType: primarySelection.fuelType,
		status: report.status as StationStatus,
		reportedAt: report.created_at,
		reportedBy: report.user_id,
		reviewStatus: (report.review_status ??
			"pending") as FuelReportReviewStatus,
		reviewedAt: report.reviewed_at,
		reviewedBy: report.reviewed_by,
		appliedStationId: report.applied_station_id,
	};
}

function formatReportedPrices(prices: Record<FuelType, number | null>) {
	return fuelTypes
		.filter((fuelType) => {
			const price = prices[fuelType];
			return typeof price === "number" && Number.isFinite(price) && price > 0;
		})
		.map((fuelType) => `${fuelType}: P${prices[fuelType]!.toFixed(2)}`)
		.join(" • ");
}

function formatReviewStatusLabel(status: FuelReportReviewStatus) {
	if (status === "pending") return "Pending";
	if (status === "approved") return "Approved";
	return "Rejected";
}

function ReviewStatusBadge({ status }: { status: FuelReportReviewStatus }) {
	const styles =
		status === "approved"
			? "bg-success/15 text-success"
			: status === "rejected"
				? "bg-destructive/15 text-destructive"
				: "bg-warning/15 text-warning";

	return (
		<span
			className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles}`}
		>
			{formatReviewStatusLabel(status)}
		</span>
	);
}

function buildStationPayload(stationForm: StationFormState) {
	const lat = Number.parseFloat(stationForm.lat);
	const lng = Number.parseFloat(stationForm.lng);

	if (!stationForm.name.trim()) throw new Error("Station name is required");
	if (!stationForm.address.trim())
		throw new Error("Station address is required");
	if (Number.isNaN(lat)) throw new Error("Latitude must be a valid number");
	if (Number.isNaN(lng)) throw new Error("Longitude must be a valid number");

	const prices = fuelTypes.reduce<Record<FuelType, number | null>>(
		(accumulator, fuelType) => {
			const rawValue = stationForm.prices[fuelType].trim();
			if (!rawValue) {
				accumulator[fuelType] = null;
				return accumulator;
			}

			const parsedValue = Number.parseFloat(rawValue);
			if (Number.isNaN(parsedValue)) {
				throw new Error(`${fuelType} price must be a valid number`);
			}

			accumulator[fuelType] = parsedValue;
			return accumulator;
		},
		{
			Unleaded: null,
			Premium: null,
			Diesel: null,
		},
	);

	const pricePerLiter = prices[stationForm.fuelType];
	if (pricePerLiter === null) {
		throw new Error(
			`Add a ${stationForm.fuelType} price to match the selected fuel type`,
		);
	}

	return {
		name: stationForm.name.trim(),
		address: stationForm.address.trim(),
		lat,
		lng,
		prices,
		fuel_type: stationForm.fuelType,
		price_per_liter: pricePerLiter,
		status: stationForm.status,
	};
}

function normalizeStationPricesForForm(
	rawPrices: unknown,
	fuelType: FuelType,
	fallbackPricePerLiter: number,
): StationPricesFormState {
	const prices: StationPricesFormState = {
		Unleaded: "",
		Premium: "",
		Diesel: "",
	};

	if (
		rawPrices &&
		typeof rawPrices === "object" &&
		!Array.isArray(rawPrices)
	) {
		for (const key of fuelTypes) {
			const value = rawPrices[key as keyof typeof rawPrices];
			if (typeof value === "number" && Number.isFinite(value)) {
				prices[key] = value.toFixed(2);
			} else if (
				typeof value === "string" &&
				value.trim() !== "" &&
				!Number.isNaN(Number(value))
			) {
				prices[key] = Number(value).toFixed(2);
			}
		}
	}

	if (
		!prices[fuelType] &&
		Number.isFinite(fallbackPricePerLiter) &&
		fallbackPricePerLiter > 0
	) {
		prices[fuelType] = fallbackPricePerLiter.toFixed(2);
	}

	return prices;
}

export function AdminDashboard() {
	const { user } = useAuth();
	const { isAdmin, isLoading: roleLoading } = useAdminRole();
	const queryClient = useQueryClient();

	const [activeSection, setActiveSection] =
		useState<AdminSection>("stations");
	const [showStationForm, setShowStationForm] = useState(false);
	const [editingStationId, setEditingStationId] = useState<string | null>(
		null,
	);
	const [stationForm, setStationForm] =
		useState<StationFormState>(initialStationForm);
	const [stationSearch, setStationSearch] = useState("");
	const [reportSearch, setReportSearch] = useState("");
	const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
	const [claimSearch, setClaimSearch] = useState("");
	const [openingReportPhotoId, setOpeningReportPhotoId] = useState<
		string | null
	>(null);
	const [claimFilter, setClaimFilter] = useState<ClaimFilter>("pending");

	const { data: stations = [], isLoading: stationsLoading } = useQuery({
		queryKey: ["admin", "gas_stations"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("gas_stations")
				.select("*")
				.order("updated_at", { ascending: false });

			if (error) throw error;
			return data ?? [];
		},
		enabled: isAdmin,
	});

	const { data: reports = [], isLoading: reportsLoading } = useQuery({
		queryKey: ["admin", "fuel_reports"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("fuel_reports")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) throw error;
			return (data ?? []).map(mapFuelReport);
		},
		enabled: isAdmin,
	});
	const { data: claimRequests = [], isLoading: claimsLoading } =
		useAdminStationClaims(isAdmin);
	const approveClaim = useApproveStationClaim();
	const rejectClaim = useRejectStationClaim();

	const stationLookup = useMemo(
		() => new Map(stations.map((station) => [station.id, station])),
		[stations],
	);

	const filteredStations = useMemo(() => {
		const query = stationSearch.trim().toLowerCase();
		if (!query) return stations;

		return stations.filter((station) => {
			return (
				station.name.toLowerCase().includes(query) ||
				station.address.toLowerCase().includes(query)
			);
		});
	}, [stations, stationSearch]);

	const filteredReports = useMemo(() => {
		const query = reportSearch.trim().toLowerCase();

		return reports.filter((report) => {
			const matchesFilter =
				reportFilter === "all" || report.reviewStatus === reportFilter;
			const matchesSearch =
				!query ||
				report.stationName.toLowerCase().includes(query) ||
				report.fuelType.toLowerCase().includes(query) ||
				report.status.toLowerCase().includes(query);

			return matchesFilter && matchesSearch;
		});
	}, [reportFilter, reportSearch, reports]);
	const filteredClaims = useMemo(() => {
		const query = claimSearch.trim().toLowerCase();

		return claimRequests.filter((claim) => {
			const station = stationLookup.get(claim.stationId);
			const matchesFilter =
				claimFilter === "all" || claim.reviewStatus === claimFilter;
			const matchesSearch =
				!query ||
				station?.name.toLowerCase().includes(query) ||
				claim.businessName.toLowerCase().includes(query) ||
				claim.contactName.toLowerCase().includes(query) ||
				claim.contactPhone.toLowerCase().includes(query);

			return matchesFilter && matchesSearch;
		});
	}, [claimFilter, claimRequests, claimSearch, stationLookup]);

	const pendingReports = reports.filter(
		(report) => report.reviewStatus === "pending",
	).length;
	const pendingClaims = claimRequests.filter(
		(claim) => claim.reviewStatus === "pending",
	).length;
	const reviewedReports = reports.filter(
		(report) => report.reviewStatus !== "pending",
	).length;
	const updatesToday = reports.filter((report) => {
		return (
			new Date(report.reportedAt).toDateString() ===
			new Date().toDateString()
		);
	}).length;

	const resetStationEditor = () => {
		setEditingStationId(null);
		setStationForm(initialStationForm);
		setShowStationForm(false);
	};

	const refreshAdminData = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["admin", "gas_stations"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["admin", "fuel_reports"],
			}),
			queryClient.invalidateQueries({
				queryKey: ["admin", "station_claim_requests"],
			}),
			queryClient.invalidateQueries({ queryKey: ["gas_stations"] }),
		]);
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
			await refreshAdminData();
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
			await refreshAdminData();
			toast.success("Station deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	const approveReport = useMutation({
		mutationFn: async (reportId: string) => {
			const { data, error } = await supabase.rpc("approve_fuel_report", {
				_report_id: reportId,
			});

			if (error) throw error;
			return data;
		},
		onSuccess: async (stationId) => {
			await refreshAdminData();
			const matchedStation = stationId
				? stationLookup.get(stationId)
				: null;
			toast.success(
				matchedStation
					? `Report approved and applied to ${matchedStation.name}`
					: "Report approved",
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const rejectReport = useMutation({
		mutationFn: async (reportId: string) => {
			const { error } = await supabase.rpc("reject_fuel_report", {
				_report_id: reportId,
			});

			if (error) throw error;
		},
		onSuccess: async () => {
			await refreshAdminData();
			toast.success("Report rejected");
		},
		onError: (error) => toast.error(error.message),
	});

	const openReportPhoto = async (report: FuelReport) => {
		if (!report.photoPath) {
			return;
		}

		try {
			setOpeningReportPhotoId(report.id);
			const signedUrl = await createFuelReportPhotoUrl(report.photoPath);
			window.open(signedUrl, "_blank", "noopener,noreferrer");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to open report photo",
			);
		} finally {
			setOpeningReportPhotoId(null);
		}
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

	if (roleLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!user || !isAdmin) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							Admin access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							This dashboard is only available to users with the
							admin role.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ ease: [0.2, 0.8, 0.2, 1] }}
			className="flex flex-col gap-6"
		>
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<h2 className="text-headline text-foreground">
						Admin Dashboard
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Manage fuel stations and review community-submitted
						reports.
					</p>
				</div>
				<div className="flex gap-2">
					<button
						onClick={() => setActiveSection("stations")}
						className={`rounded-full px-4 py-2 text-sm font-medium ${
							activeSection === "stations"
								? "bg-primary text-primary-foreground"
								: "bg-secondary text-muted-foreground hover:text-foreground"
						}`}
					>
						Stations
					</button>
					<button
						onClick={() => setActiveSection("reports")}
						className={`rounded-full px-4 py-2 text-sm font-medium ${
							activeSection === "reports"
								? "bg-primary text-primary-foreground"
								: "bg-secondary text-muted-foreground hover:text-foreground"
						}`}
					>
						Reports
					</button>
					<button
						onClick={() => setActiveSection("claims")}
						className={`rounded-full px-4 py-2 text-sm font-medium ${
							activeSection === "claims"
								? "bg-primary text-primary-foreground"
								: "bg-secondary text-muted-foreground hover:text-foreground"
						}`}
					>
						Claims
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				{[
					{ label: "Stations", value: stations.length, icon: Fuel },
					{
						label: "Pending Reports",
						value: pendingReports,
						icon: FileText,
					},
					{
						label: "Pending Claims",
						value: pendingClaims,
						icon: ShieldAlert,
					},
					{
						label: "Reviewed Reports",
						value: reviewedReports,
						icon: CheckCircle2,
					},
					{
						label: "Updates Today",
						value: updatesToday,
						icon: Activity,
					},
				].map((stat, index) => (
					<motion.div
						key={stat.label}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							delay: index * 0.04,
							ease: [0.2, 0.8, 0.2, 1],
						}}
						className="rounded-xl bg-card p-5 shadow-sovereign"
					>
						<stat.icon className="h-5 w-5 text-accent" />
						<p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
							{stat.value}
						</p>
						<p className="text-label text-muted-foreground">
							{stat.label}
						</p>
					</motion.div>
				))}
			</div>

			{activeSection === "stations" && (
				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<h3 className="text-ui font-semibold text-foreground">
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
									showStationForm
										? resetStationEditor
										: beginCreateStation
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
										existingStations={stations.map(
											(station) => ({
												lat: station.lat,
												lng: station.lng,
											}),
										)}
									/>
									<select
										value={stationForm.fuelType}
										onChange={(event) =>
											setStationForm((current) => ({
												...current,
												fuelType: event.target
													.value as FuelType,
											}))
										}
										className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									>
										<option value="Diesel">Diesel</option>
										<option value="Unleaded">
											Unleaded
										</option>
										<option value="Premium">Premium</option>
									</select>
									<select
										value={stationForm.status}
										onChange={(event) =>
											setStationForm((current) => ({
												...current,
												status: event.target
													.value as StationStatus,
											}))
										}
										className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									>
										<option value="Available">
											Available
										</option>
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
													Add each available fuel
													price. The selected fuel
													type becomes the main
													displayed price.
												</p>
											</div>
											<span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
												Primary:{" "}
												<b>{stationForm.fuelType}</b>
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
														value={
															stationForm.prices[
																fuelType
															]
														}
														onChange={(event) =>
															setStationForm(
																(current) => ({
																	...current,
																	prices: {
																		...current.prices,
																		[fuelType]:
																			event
																				.target
																				.value,
																	},
																}),
															)
														}
														className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
													/>
												</div>
											))}
										</div>
										<p className="mt-3 text-xs text-muted-foreground">
											Current display price:{" "}
											{stationForm.prices[
												stationForm.fuelType
											]
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
										{editingStationId
											? "Save Station"
											: "Create Station"}
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
													status={
														station.status as StationStatus
													}
												/>
											</div>
											<p className="mt-1 text-sm text-muted-foreground">
												{station.address}
											</p>
											<p className="mt-2 text-sm text-muted-foreground">
												{station.fuel_type} • ₱
												{Number(
													station.price_per_liter,
												).toFixed(2)}{" "}
												• {station.report_count} reports
											</p>
											<p className="text-xs text-muted-foreground">
												{station.lat.toFixed(5)},{" "}
												{station.lng.toFixed(5)}
											</p>
										</div>

										<div className="flex gap-2">
											<button
												onClick={() =>
													beginEditStation(station)
												}
												className="flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
											>
												<Pencil className="h-4 w-4" />
												Edit
											</button>
											<button
												onClick={() => {
													if (
														window.confirm(
															`Delete ${station.name}?`,
														)
													) {
														deleteStation.mutate(
															station.id,
														);
													}
												}}
												disabled={
													deleteStation.isPending
												}
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
			)}

			{activeSection === "reports" && (
				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<h3 className="text-ui font-semibold text-foreground">
								Report Review
							</h3>
							<p className="text-sm text-muted-foreground">
								Approve or reject community-submitted fuel
								updates.
							</p>
						</div>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								placeholder="Search reports"
								value={reportSearch}
								onChange={(event) =>
									setReportSearch(event.target.value)
								}
								className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
							/>
						</div>
					</div>

					<div className="mb-4 flex flex-wrap gap-2">
						{reportFilters.map((filter) => (
							<button
								key={filter.value}
								onClick={() => setReportFilter(filter.value)}
								className={`rounded-full px-4 py-1.5 text-sm font-medium ${
									reportFilter === filter.value
										? "bg-accent text-accent-foreground"
										: "bg-surface-alt text-muted-foreground hover:text-foreground"
								}`}
							>
								{filter.label}
							</button>
						))}
					</div>

					<div className="flex flex-col gap-3">
						{reportsLoading ? (
							<div className="flex items-center justify-center py-10">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : filteredReports.length === 0 ? (
							<p className="py-8 text-center text-sm text-muted-foreground">
								No reports match the current filter.
							</p>
						) : (
							filteredReports.map((report) => {
								const appliedStation = report.appliedStationId
									? stationLookup.get(report.appliedStationId)
									: null;
								const isPending =
									report.reviewStatus === "pending";

								return (
									<div
										key={report.id}
										className="rounded-xl border border-border bg-secondary/40 p-4"
									>
										<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-semibold text-foreground">
														{report.stationName}
													</p>
													<ReviewStatusBadge
														status={
															report.reviewStatus
														}
													/>
													<StatusBadge
														status={report.status}
													/>
												</div>

												<p className="mt-1 text-sm text-muted-foreground">
													{formatReportedPrices(
														report.prices,
													) || "No valid prices"}{" "}
													•{" "}
													{new Date(
														report.reportedAt,
													).toLocaleString()}
												</p>

												{report.lat !== null &&
													report.lng !== null && (
														<p className="text-xs text-muted-foreground">
															GPS:{" "}
															{report.lat.toFixed(
																5,
															)}
															,{" "}
															{report.lng.toFixed(
																5,
															)}
														</p>
													)}

												{report.photoPath && (
													<p className="mt-2 text-xs">
														<button
															type="button"
															onClick={() =>
																void openReportPhoto(
																	report,
																)
															}
															disabled={
																openingReportPhotoId ===
																report.id
															}
															className="font-medium text-accent hover:underline disabled:opacity-60"
														>
															{openingReportPhotoId ===
															report.id
																? "Opening photo..."
																: `View report photo${
																		report.photoFilename
																			? ` (${report.photoFilename})`
																			: ""
																  }`}
														</button>
													</p>
												)}

												<p className="mt-2 text-xs text-muted-foreground">
													Submitted by{" "}
													{report.reportedBy.slice(
														0,
														8,
													)}
													{report.reviewedAt
														? ` • Reviewed ${new Date(report.reviewedAt).toLocaleString()}`
														: ""}
												</p>

												{appliedStation && (
													<p className="mt-1 text-xs font-medium text-success">
														Applied to station:{" "}
														{appliedStation.name}
													</p>
												)}
											</div>

											<div className="flex gap-2">
												{isPending ? (
													<>
														<button
															onClick={() =>
																approveReport.mutate(
																	report.id,
																)
															}
															disabled={
																approveReport.isPending ||
																rejectReport.isPending
															}
															className="flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
														>
															<CheckCircle2 className="h-4 w-4" />
															Approve
														</button>
														<button
															onClick={() =>
																rejectReport.mutate(
																	report.id,
																)
															}
															disabled={
																approveReport.isPending ||
																rejectReport.isPending
															}
															className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
														>
															<XCircle className="h-4 w-4" />
															Reject
														</button>
													</>
												) : (
													<p className="text-sm text-muted-foreground">
														{formatReviewStatusLabel(
															report.reviewStatus,
														)}{" "}
														report
													</p>
												)}
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}

			{activeSection === "claims" && (
				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<h3 className="text-ui font-semibold text-foreground">
								Station Claims
							</h3>
							<p className="text-sm text-muted-foreground">
								Review station ownership requests and verify
								approved business managers.
							</p>
						</div>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								placeholder="Search claims"
								value={claimSearch}
								onChange={(event) =>
									setClaimSearch(event.target.value)
								}
								className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
							/>
						</div>
					</div>

					<div className="mb-4 flex flex-wrap gap-2">
						{claimFilters.map((filter) => (
							<button
								key={filter.value}
								onClick={() => setClaimFilter(filter.value)}
								className={`rounded-full px-4 py-1.5 text-sm font-medium ${
									claimFilter === filter.value
										? "bg-accent text-accent-foreground"
										: "bg-surface-alt text-muted-foreground hover:text-foreground"
								}`}
							>
								{filter.label}
							</button>
						))}
					</div>

					<div className="flex flex-col gap-3">
						{claimsLoading ? (
							<div className="flex items-center justify-center py-10">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : filteredClaims.length === 0 ? (
							<p className="py-8 text-center text-sm text-muted-foreground">
								No station claims match the current filter.
							</p>
						) : (
							filteredClaims.map((claim) => {
								const station = stationLookup.get(claim.stationId);
								const isPending =
									claim.reviewStatus === "pending";

								return (
									<div
										key={claim.id}
										className="rounded-xl border border-border bg-secondary/40 p-4"
									>
										<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-semibold text-foreground">
														{station?.name ??
															"Unknown Station"}
													</p>
													<ReviewStatusBadge
														status={claim.reviewStatus}
													/>
													{station?.is_verified && (
														<VerifiedStationBadge className="py-0.5" />
													)}
												</div>
												<p className="mt-1 text-sm text-muted-foreground">
													{station?.address ??
														"Station address unavailable"}
												</p>
												<p className="mt-2 text-sm text-foreground">
													{claim.businessName}
												</p>
												<p className="text-xs text-muted-foreground">
													Contact: {claim.contactName} •{" "}
													{claim.contactPhone}
												</p>
												{claim.notes && (
													<p className="mt-2 text-xs text-muted-foreground">
														Notes: {claim.notes}
													</p>
												)}
												{claim.proofDocumentUrl && (
													<p className="mt-2 text-xs">
														<a
															href={claim.proofDocumentUrl}
															target="_blank"
															rel="noreferrer"
															className="font-medium text-accent hover:underline"
														>
															View proof document
															{claim.proofDocumentFilename
																? ` (${claim.proofDocumentFilename})`
																: ""}
														</a>
													</p>
												)}
												<p className="mt-2 text-xs text-muted-foreground">
													Submitted{" "}
													{new Date(
														claim.createdAt,
													).toLocaleString()}
													{claim.reviewedAt
														? ` • Reviewed ${new Date(claim.reviewedAt).toLocaleString()}`
														: ""}
												</p>
											</div>

											<div className="flex gap-2">
												{isPending ? (
													<>
														<button
															onClick={() =>
																approveClaim.mutate(
																	claim.id,
																	{
																		onSuccess:
																			() => {
																			toast.success(
																				`Claim approved for ${station?.name ?? "station"}`,
																			);
																		},
																		onError:
																			(error) => {
																			toast.error(
																				error.message,
																			);
																		},
																	},
																)
															}
															disabled={
																approveClaim.isPending ||
																rejectClaim.isPending
															}
															className="flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
														>
															<CheckCircle2 className="h-4 w-4" />
															Approve
														</button>
														<button
															onClick={() =>
																rejectClaim.mutate(
																	claim.id,
																	{
																		onSuccess:
																			() => {
																			toast.success(
																				"Claim rejected",
																			);
																		},
																		onError:
																			(error) => {
																			toast.error(
																				error.message,
																			);
																		},
																	},
																)
															}
															disabled={
																approveClaim.isPending ||
																rejectClaim.isPending
															}
															className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
														>
															<XCircle className="h-4 w-4" />
															Reject
														</button>
													</>
												) : (
													<p className="text-sm text-muted-foreground">
														{formatReviewStatusLabel(
															claim.reviewStatus,
														)}{" "}
														claim
													</p>
												)}
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}
		</motion.div>
	);
}

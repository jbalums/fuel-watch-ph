import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	Loader2,
	Search,
	XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { createFuelReportPhotoUrl } from "@/lib/fuel-report-photo-upload";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { StatusBadge } from "@/components/StatusBadge";
import {
	formatReportedPrices,
	formatReviewStatusLabel,
	type ReportFilter,
	refreshAdminData,
	reportFilters,
	ReviewStatusBadge,
	useAdminReports,
	useAdminStations,
} from "@/components/admin/admin-shared";

export default function AdminReportsPage() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: stations = [] } = useAdminStations();
	const { data: reports = [], isLoading: reportsLoading } = useAdminReports();
	const [reportSearch, setReportSearch] = useState("");
	const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
	const [openingReportPhotoId, setOpeningReportPhotoId] = useState<
		string | null
	>(null);

	const stationLookup = useMemo(
		() => new Map(stations.map((station) => [station.id, station])),
		[stations],
	);

	const filteredReports = useMemo(() => {
		const query = reportSearch.trim().toLowerCase();

		return reports.filter((report) => {
			const matchesFilter =
				reportFilter === "all" || report.reviewStatus === reportFilter;
			const linkedStationName = report.stationId
				? stationLookup.get(report.stationId)?.name ?? ""
				: "";
			const reportedAddress = report.reportedAddress ?? "";
			const matchesSearch =
				!query ||
				report.stationName.toLowerCase().includes(query) ||
				linkedStationName.toLowerCase().includes(query) ||
				reportedAddress.toLowerCase().includes(query) ||
				report.fuelType.toLowerCase().includes(query) ||
				report.status.toLowerCase().includes(query);

			return matchesFilter && matchesSearch;
		});
	}, [reportFilter, reportSearch, reports, stationLookup]);
	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedReports,
		setCurrentPage,
	} = usePaginatedList(
		filteredReports,
		`${reportSearch}::${reportFilter}`,
	);

	const approveReport = useMutation({
		mutationFn: async (reportId: string) => {
			const { data, error } = await supabase.rpc("approve_fuel_report", {
				_report_id: reportId,
			});

			if (error) throw error;
			return data;
		},
		onSuccess: async (stationId) => {
			await refreshAdminData(queryClient);
			const matchedStation = stationId ? stationLookup.get(stationId) : null;
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
			await refreshAdminData(queryClient);
			toast.success("Report rejected");
		},
		onError: (error) => toast.error(error.message),
	});

	const openReportPhoto = async (reportId: string, photoPath: string) => {
		try {
			setOpeningReportPhotoId(reportId);
			const signedUrl = await createFuelReportPhotoUrl(photoPath);
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

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						Report Review
					</h3>
					<p className="text-sm text-muted-foreground">
						Approve or reject community-submitted fuel updates.
					</p>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search reports"
						value={reportSearch}
						onChange={(event) => setReportSearch(event.target.value)}
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
					paginatedReports.map((report) => {
						const appliedStation = report.appliedStationId
							? stationLookup.get(report.appliedStationId)
							: null;
						const linkedStation = report.stationId
							? stationLookup.get(report.stationId)
							: null;
						const isPending = report.reviewStatus === "pending";

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
											{report.isLguVerified && (
												<LguVerifiedBadge className="py-0.5" />
											)}
											<ReviewStatusBadge
												status={report.reviewStatus}
											/>
											<StatusBadge status={report.status} />
										</div>

										<p className="mt-1 text-sm text-muted-foreground">
											{formatReportedPrices(report.prices) ||
												"No valid prices"}{" "}
											•{" "}
											{new Date(
												report.reportedAt,
											).toLocaleString()}
										</p>

										<p className="mt-2 text-xs font-medium text-foreground">
											{report.stationId
												? `Existing station update${
														linkedStation
															? `: ${linkedStation.name}`
															: ""
													}`
												: "New station candidate"}
										</p>

										{report.reportedAddress && (
											<p className="text-xs text-muted-foreground">
												Address: {report.reportedAddress}
											</p>
										)}

										{report.lat !== null &&
											report.lng !== null && (
												<p className="text-xs">
													<button
														type="button"
														onClick={() =>
															navigate("/map", {
																state: {
																	reportLocation: {
																		lat: report.lat!,
																		lng: report.lng!,
																		label: "Reported location",
																	},
																},
															})
														}
														className="text-muted-foreground underline-offset-2 transition-colors hover:text-accent hover:underline"
													>
														GPS: {report.lat.toFixed(5)},{" "}
														{report.lng.toFixed(5)}
													</button>
												</p>
											)}

										{report.photoPath && (
											<p className="mt-2 text-xs">
												<button
													type="button"
													onClick={() =>
														void openReportPhoto(
															report.id,
															report.photoPath!,
														)
													}
													disabled={
														openingReportPhotoId ===
														report.id
													}
													className="font-medium text-accent hover:underline disabled:opacity-60"
												>
													{openingReportPhotoId === report.id
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
											Submitted by {report.reportedBy.slice(0, 8)}
											{report.reviewedAt
												? ` • Reviewed ${new Date(report.reviewedAt).toLocaleString()}`
												: ""}
										</p>

										{appliedStation && (
											<p className="mt-1 text-xs font-medium text-success">
												Applied to station: {appliedStation.name}
											</p>
										)}
									</div>

									<div className="flex gap-2">
										{isPending ? (
											<>
												<button
													onClick={() =>
														approveReport.mutate(report.id)
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
														rejectReport.mutate(report.id)
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
			<AdminListPagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
			/>
		</div>
	);
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
	CheckCircle2,
	Loader2,
	Search,
	XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { StatusBadge } from "@/components/StatusBadge";
import {
	createEasyReportApprovalForm,
	type EasyReportApprovalFormState,
	getFuelReportDisplayName,
	getFuelReportModeLabel,
	formatReportedPrices,
	formatReviewStatusLabel,
	type ReportFilter,
	refreshAdminData,
	reportFilters,
	ReviewStatusBadge,
	useAdminReports,
	useAdminStations,
} from "@/components/admin/admin-shared";
import { EasyReportApprovalDialog } from "@/components/admin/EasyReportApprovalDialog";
import { ReportPhotoPreviewDialog } from "@/components/admin/ReportPhotoPreviewDialog";
import {
	hasAnyFuelAvailability,
	parseFuelAvailabilityForm,
	parseFuelPriceForm,
	validateFuelPriceAvailability,
} from "@/lib/fuel-prices";

export default function AdminReportsPage() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: stations = [] } = useAdminStations();
	const { data: reports = [], isLoading: reportsLoading } = useAdminReports();
	const { provinces, cities = [] } = useGeoReferences({
		provinceCode: easyApprovalForm?.provinceCode,
	});
	const [reportSearch, setReportSearch] = useState("");
	const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
	const [reportPhotoPreview, setReportPhotoPreview] = useState<{
		path: string;
		filename: string | null;
		mode: "easy" | "standard";
	} | null>(null);
	const [reportToApprove, setReportToApprove] = useState<
		(typeof reports)[number] | null
	>(null);
	const [easyApprovalForm, setEasyApprovalForm] =
		useState<EasyReportApprovalFormState | null>(null);
	const [easyApprovalError, setEasyApprovalError] = useState<string | null>(
		null,
	);
	const [reportToReject, setReportToReject] = useState<
		(typeof reports)[number] | null
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
			const reportName = getFuelReportDisplayName(report);
			const matchesSearch =
				!query ||
				reportName.toLowerCase().includes(query) ||
				linkedStationName.toLowerCase().includes(query) ||
				reportedAddress.toLowerCase().includes(query) ||
				(report.fuelType ?? "").toLowerCase().includes(query) ||
				(report.status ?? "").toLowerCase().includes(query);

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

	const approveEasyReport = useMutation({
		mutationFn: async ({
			reportId,
			form,
		}: {
			reportId: string;
			form: EasyReportApprovalFormState;
		}) => {
			const normalizedPrices = parseFuelPriceForm(form.prices);
			const normalizedAvailability = parseFuelAvailabilityForm(
				form.fuelAvailability,
			);
			validateFuelPriceAvailability(
				normalizedPrices,
				normalizedAvailability,
			);

			if (!hasAnyFuelAvailability(normalizedAvailability)) {
				throw new Error(
					"Add at least one fuel availability or price before approval",
				);
			}

			const fallbackStationName = form.stationId
				? stationLookup.get(form.stationId)?.name ?? "Selected station"
				: form.stationName.trim();
			const stationName = fallbackStationName.trim();

			if (!stationName) {
				throw new Error("Station name is required");
			}
			if (!form.provinceCode.trim()) {
				throw new Error("Province is required");
			}
			if (!form.cityMunicipalityCode.trim()) {
				throw new Error("City or municipality is required");
			}

			const { data, error } = await supabase.rpc(
				"approve_easy_fuel_report",
				{
					_report_id: reportId,
					_station_name: stationName,
					_station_id: form.stationId || null,
					_reported_address:
						form.reportedAddress.trim() || null,
					_province_code: form.provinceCode.trim(),
					_city_municipality_code:
						form.cityMunicipalityCode.trim(),
					_prices: normalizedPrices,
					_fuel_availability: normalizedAvailability,
				},
			);

			if (error) throw error;
			return data;
		},
		onSuccess: async (stationId) => {
			await refreshAdminData(queryClient);
			const matchedStation = stationId ? stationLookup.get(stationId) : null;
			toast.success(
				matchedStation
					? `Easy report approved and applied to ${matchedStation.name}`
					: "Easy report approved",
			);
		},
		onError: (error) => {
			setEasyApprovalError(error.message);
		},
	});

	useEffect(() => {
		if (reportToApprove?.submissionMode === "easy") {
			setEasyApprovalForm(createEasyReportApprovalForm(reportToApprove));
			setEasyApprovalError(null);
			return;
		}

		setEasyApprovalForm(null);
		setEasyApprovalError(null);
	}, [reportToApprove]);

	const rejectReport = useMutation({
		mutationFn: async (reportId: string) => {
			const { error } = await supabase.rpc("reject_fuel_report", {
				_report_id: reportId,
			});

			if (error) throw error;
		},
		onSuccess: async () => {
			await refreshAdminData(queryClient);
			toast.destructive("Report rejected");
		},
		onError: (error) => toast.error(error.message),
	});

	const confirmRejectReport = () => {
		if (!reportToReject || rejectReport.isPending) {
			return;
		}

		rejectReport.mutate(reportToReject.id, {
			onSuccess: async () => {
				await refreshAdminData(queryClient);
				toast.destructive("Report rejected");
				setReportToReject(null);
			},
			onError: (error) => toast.error(error.message),
		});
	};

	const confirmApproveReport = () => {
		if (!reportToApprove) {
			return;
		}

		if (reportToApprove.submissionMode === "easy") {
			if (!easyApprovalForm || approveEasyReport.isPending) {
				return;
			}

			approveEasyReport.mutate(
				{
					reportId: reportToApprove.id,
					form: easyApprovalForm,
				},
				{
					onSuccess: async (stationId) => {
						await refreshAdminData(queryClient);
						const matchedStation = stationId
							? stationLookup.get(stationId)
							: null;
						toast.success(
							matchedStation
								? `Easy report approved and applied to ${matchedStation.name}`
								: "Easy report approved",
						);
						setReportToApprove(null);
					},
					onError: (error) => setEasyApprovalError(error.message),
				},
			);
			return;
		}

		if (approveReport.isPending) {
			return;
		}

		approveReport.mutate(reportToApprove.id, {
			onSuccess: async (stationId) => {
				await refreshAdminData(queryClient);
				const matchedStation = stationId
					? stationLookup.get(stationId)
					: null;
				toast.success(
					matchedStation
						? `Report approved and applied to ${matchedStation.name}`
						: "Report approved",
				);
				setReportToApprove(null);
			},
			onError: (error) => toast.error(error.message),
		});
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
												{getFuelReportDisplayName(report)}
											</p>
											{report.isLguVerified && (
												<LguVerifiedBadge className="py-0.5" />
											)}
											<ReviewStatusBadge
												status={report.reviewStatus}
											/>
											{report.status ? (
												<StatusBadge
													status={report.status}
												/>
											) : null}
											{report.submissionMode === "easy" ? (
												<span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
													{getFuelReportModeLabel(
														report.submissionMode,
													)}
												</span>
											) : null}
										</div>

										<p className="mt-1 text-sm text-muted-foreground">
											{formatReportedPrices(
												report.prices,
												report.fuelAvailability,
											) ||
												(report.submissionMode === "easy"
													? "Awaiting manual price entry"
													: "No valid prices")}{" "}
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
														setReportPhotoPreview({
															path: report.photoPath!,
															filename:
																report.photoFilename,
															mode:
																report.submissionMode,
														})
													}
													className="font-medium text-accent hover:underline"
												>
													{`View ${
														report.submissionMode ===
														"easy"
															? "reference"
															: "report"
													} photo${
														report.photoFilename
															? ` (${report.photoFilename})`
															: ""
													}`}
												</button>
											</p>
										)}

										<p className="mt-2 text-xs text-muted-foreground">
											Reported by {report.reportedByLabel}
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
														setReportToApprove(report)
													}
													disabled={
														approveReport.isPending ||
														approveEasyReport.isPending ||
														rejectReport.isPending
													}
													className="flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
												>
													<CheckCircle2 className="h-4 w-4" />
													Approve
												</button>
												<button
													onClick={() =>
														setReportToReject(report)
													}
													disabled={
														approveReport.isPending ||
														approveEasyReport.isPending ||
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

			<AlertDialog
				open={
					!!reportToApprove &&
					reportToApprove.submissionMode !== "easy"
				}
				onOpenChange={(open) => {
					if (!open && !approveReport.isPending) {
						setReportToApprove(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Approve fuel report?</AlertDialogTitle>
						<AlertDialogDescription>
							This will approve the selected report and apply its
							data to the matching station record.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{reportToApprove && (
						<div className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{getFuelReportDisplayName(reportToApprove)}
							</p>
							<p className="mt-1 text-muted-foreground">
								{formatReportedPrices(
									reportToApprove.prices,
									reportToApprove.fuelAvailability,
								) ||
									"No valid prices"}
							</p>
							<p className="mt-1 text-muted-foreground">
								{reportToApprove.reportedAddress ??
									(reportToApprove.lat !== null &&
									reportToApprove.lng !== null
										? `GPS: ${reportToApprove.lat.toFixed(5)}, ${reportToApprove.lng.toFixed(5)}`
										: "No address or GPS")}
							</p>
							<p className="text-xs text-muted-foreground">
								Submitted{" "}
								{new Date(
									reportToApprove.reportedAt,
								).toLocaleString()}
							</p>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={approveReport.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmApproveReport}
							disabled={approveReport.isPending}
						>
							{approveReport.isPending
								? "Approving..."
								: "Approve report"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<EasyReportApprovalDialog
				open={
					!!reportToApprove &&
					reportToApprove.submissionMode === "easy"
				}
				onOpenChange={(open) => {
					if (!open && !approveEasyReport.isPending) {
						setReportToApprove(null);
					}
				}}
				report={reportToApprove}
				form={easyApprovalForm}
				setForm={setEasyApprovalForm}
				stations={stations}
				provinces={provinces}
				cities={cities}
				onApprove={confirmApproveReport}
				approving={approveEasyReport.isPending}
				validationMessage={easyApprovalError}
			/>

			<ReportPhotoPreviewDialog
				open={!!reportPhotoPreview}
				onOpenChange={(open) => {
					if (!open) {
						setReportPhotoPreview(null);
					}
				}}
				photoPath={reportPhotoPreview?.path ?? null}
				photoFilename={reportPhotoPreview?.filename ?? null}
				title={
					reportPhotoPreview?.mode === "easy"
						? "Reference Photo"
						: "Report Photo"
				}
				description={
					reportPhotoPreview?.mode === "easy"
						? "Review the Easy Report image at full size."
						: "Review the attached report image at full size."
				}
			/>

			<AlertDialog
				open={!!reportToReject}
				onOpenChange={(open) => {
					if (!open && !rejectReport.isPending) {
						setReportToReject(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Reject fuel report?</AlertDialogTitle>
						<AlertDialogDescription>
							This will mark the selected report as rejected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{reportToReject && (
						<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{reportToReject.stationName}
							</p>
							<p className="mt-1 text-muted-foreground">
								{formatReportedPrices(
									reportToReject.prices,
									reportToReject.fuelAvailability,
								) ||
									"No valid prices"}
							</p>
							<p className="mt-1 text-muted-foreground">
								{reportToReject.reportedAddress ??
									(reportToReject.lat !== null &&
									reportToReject.lng !== null
										? `GPS: ${reportToReject.lat.toFixed(5)}, ${reportToReject.lng.toFixed(5)}`
										: "No address or GPS")}
							</p>
							<p className="text-xs text-muted-foreground">
								Submitted{" "}
								{new Date(
									reportToReject.reportedAt,
								).toLocaleString()}
							</p>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={rejectReport.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmRejectReport}
							disabled={rejectReport.isPending}
						>
							{rejectReport.isPending
								? "Rejecting..."
								: "Reject report"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

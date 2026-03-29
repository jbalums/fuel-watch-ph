import { useMemo, useState } from "react";
import { Loader2, Search, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import {
	claimFilters,
	type ClaimFilter,
	formatReviewStatusLabel,
	ReviewStatusBadge,
	useAdminStations,
} from "@/components/admin/admin-shared";
import {
	useAdminStationClaims,
	useApproveStationClaim,
	useRejectStationClaim,
} from "@/hooks/useStationClaims";

export default function AdminClaimsPage() {
	const { data: stations = [] } = useAdminStations();
	const { data: claimRequests = [], isLoading: claimsLoading } =
		useAdminStationClaims(true);
	const approveClaim = useApproveStationClaim();
	const rejectClaim = useRejectStationClaim();
	const [claimSearch, setClaimSearch] = useState("");
	const [claimFilter, setClaimFilter] = useState<ClaimFilter>("pending");

	const stationLookup = useMemo(
		() => new Map(stations.map((station) => [station.id, station])),
		[stations],
	);

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

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						Station Claims
					</h3>
					<p className="text-sm text-muted-foreground">
						Review station ownership requests and verify approved
						business managers.
					</p>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search claims"
						value={claimSearch}
						onChange={(event) => setClaimSearch(event.target.value)}
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
						const isPending = claim.reviewStatus === "pending";

						return (
							<div
								key={claim.id}
								className="rounded-xl border border-border bg-secondary/40 p-4"
							>
								<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-semibold text-foreground">
												{station?.name ?? "Unknown Station"}
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
											{new Date(claim.createdAt).toLocaleString()}
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
														approveClaim.mutate(claim.id, {
															onSuccess: () => {
																toast.success(
																	`Claim approved for ${station?.name ?? "station"}`,
																);
															},
															onError: (error) => {
																toast.error(
																	error.message,
																);
															},
														})
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
														rejectClaim.mutate(claim.id, {
															onSuccess: () => {
																toast.success(
																	"Claim rejected",
																);
															},
															onError: (error) => {
																toast.error(
																	error.message,
																);
															},
														})
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
	);
}

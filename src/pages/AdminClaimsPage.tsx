import { useMemo, useState } from "react";
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
import { Loader2, Search, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/app-toast";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import { usePaginatedList } from "@/hooks/usePaginatedList";
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
	const [claimToApprove, setClaimToApprove] = useState<
		(typeof claimRequests)[number] | null
	>(null);
	const [claimToReject, setClaimToReject] = useState<
		(typeof claimRequests)[number] | null
	>(null);

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
	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedClaims,
		setCurrentPage,
	} = usePaginatedList(
		filteredClaims,
		`${claimSearch}::${claimFilter}`,
	);

	const confirmRejectClaim = () => {
		if (!claimToReject || rejectClaim.isPending) {
			return;
		}

		rejectClaim.mutate(claimToReject.id, {
			onSuccess: () => {
				toast.destructive("Claim rejected");
				setClaimToReject(null);
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	};

	const confirmApproveClaim = () => {
		if (!claimToApprove || approveClaim.isPending) {
			return;
		}

		const station = stationLookup.get(claimToApprove.stationId);
		approveClaim.mutate(claimToApprove.id, {
			onSuccess: () => {
				toast.success(
					`Claim approved for ${station?.name ?? "station"}`,
				);
				setClaimToApprove(null);
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	};

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
					paginatedClaims.map((claim) => {
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
														setClaimToApprove(claim)
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
														setClaimToReject(claim)
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
			<AdminListPagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
			/>

			<AlertDialog
				open={!!claimToApprove}
				onOpenChange={(open) => {
					if (!open && !approveClaim.isPending) {
						setClaimToApprove(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Approve station claim?</AlertDialogTitle>
						<AlertDialogDescription>
							This will approve the selected ownership request and
							assign the verified station to the claimant.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{claimToApprove && (
						<div className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{stationLookup.get(claimToApprove.stationId)?.name ??
									"Unknown Station"}
							</p>
							<p className="mt-1 text-muted-foreground">
								{claimToApprove.businessName}
							</p>
							<p className="mt-1 text-muted-foreground">
								Contact: {claimToApprove.contactName} •{" "}
								{claimToApprove.contactPhone}
							</p>
							<p className="text-xs text-muted-foreground">
								Submitted{" "}
								{new Date(
									claimToApprove.createdAt,
								).toLocaleString()}
							</p>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={approveClaim.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmApproveClaim}
							disabled={approveClaim.isPending}
						>
							{approveClaim.isPending
								? "Approving..."
								: "Approve claim"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!claimToReject}
				onOpenChange={(open) => {
					if (!open && !rejectClaim.isPending) {
						setClaimToReject(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Reject station claim?</AlertDialogTitle>
						<AlertDialogDescription>
							This will mark the selected ownership request as rejected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{claimToReject && (
						<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{stationLookup.get(claimToReject.stationId)?.name ??
									"Unknown Station"}
							</p>
							<p className="mt-1 text-muted-foreground">
								{claimToReject.businessName}
							</p>
							<p className="mt-1 text-muted-foreground">
								Contact: {claimToReject.contactName} •{" "}
								{claimToReject.contactPhone}
							</p>
							<p className="text-xs text-muted-foreground">
								Submitted{" "}
								{new Date(
									claimToReject.createdAt,
								).toLocaleString()}
							</p>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={rejectClaim.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmRejectClaim}
							disabled={rejectClaim.isPending}
						>
							{rejectClaim.isPending
								? "Rejecting..."
								: "Reject claim"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

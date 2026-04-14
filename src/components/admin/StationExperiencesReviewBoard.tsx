import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import {
	useAdminStationExperiences,
	useScopedStationExperiences,
} from "@/hooks/useStationExperiences";
import {
	getStationExperienceSentimentClassName,
	getStationExperienceSentimentLabel,
} from "@/lib/station-experience";
import type {
	StationExperience,
	StationExperienceReviewStatus,
} from "@/types/station";

const experienceFilters: {
	value: StationExperienceReviewStatus | "all";
	label: string;
}[] = [
	{ value: "pending", label: "Pending" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
	{ value: "all", label: "All" },
];

type ReviewDialogState = {
	experience: StationExperience;
	nextStatus: StationExperienceReviewStatus;
};

function getReviewBadgeClassName(status: StationExperienceReviewStatus) {
	if (status === "approved") {
		return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
	}

	if (status === "rejected") {
		return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
	}

	return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

interface StationExperiencesReviewBoardProps {
	mode: "admin" | "lgu";
}

export function StationExperiencesReviewBoard({
	mode,
}: StationExperiencesReviewBoardProps) {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const [filter, setFilter] =
		useState<StationExperienceReviewStatus | "all">("pending");
	const [searchQuery, setSearchQuery] = useState("");
	const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(
		null,
	);
	const [reviewNotes, setReviewNotes] = useState("");
	const experienceQuery =
		mode === "admin"
			? useAdminStationExperiences(filter)
			: useScopedStationExperiences(filter);

	const filteredExperiences = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		const allExperiences = experienceQuery.data ?? [];

		return allExperiences.filter((experience) => {
			if (!normalizedQuery) {
				return true;
			}

			return (
				experience.stationName.toLowerCase().includes(normalizedQuery) ||
				experience.stationAddress.toLowerCase().includes(normalizedQuery) ||
				experience.experienceText.toLowerCase().includes(normalizedQuery) ||
				experience.reporterLabel.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [experienceQuery.data, searchQuery]);

	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedExperiences,
		setCurrentPage,
	} = usePaginatedList(filteredExperiences, `${mode}:${filter}:${searchQuery}`);

	const reviewExperience = useMutation({
		mutationFn: async ({
			experience,
			nextStatus,
			notes,
		}: {
			experience: StationExperience;
			nextStatus: StationExperienceReviewStatus;
			notes: string;
		}) => {
			const { error } = await supabase
				.from("station_experiences")
				.update({
					review_status: nextStatus,
					review_notes: notes.trim() || null,
					reviewed_at: new Date().toISOString(),
					reviewed_by: user?.id ?? null,
				})
				.eq("id", experience.id);

			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["station_experiences"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "station_experiences"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["lgu", "station_experiences"],
				}),
			]);
			toast.success("Station experience review updated.");
			setReviewDialog(null);
			setReviewNotes("");
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						{mode === "admin"
							? "Station Experience Review"
							: "Scoped Station Experience Review"}
					</h3>
					<p className="text-sm text-muted-foreground">
						Review community experience posts before they become public.
					</p>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search experiences"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
					/>
				</div>
			</div>

			<div className="mb-4 flex flex-wrap gap-2">
				{experienceFilters.map((experienceFilter) => (
					<button
						key={experienceFilter.value}
						onClick={() => setFilter(experienceFilter.value)}
						className={`rounded-full px-4 py-1.5 text-sm font-medium ${
							filter === experienceFilter.value
								? "bg-accent text-accent-foreground"
								: "bg-surface-alt text-muted-foreground hover:text-foreground"
						}`}
					>
						{experienceFilter.label}
					</button>
				))}
			</div>

			<div className="flex flex-col gap-3">
				{experienceQuery.isLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : filteredExperiences.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No experiences match the current filter.
					</p>
				) : (
					paginatedExperiences.map((experience) => {
						const isPending = experience.reviewStatus === "pending";

						return (
							<div
								key={experience.id}
								className="rounded-xl border border-border bg-secondary/40 p-4"
							>
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div className="space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-base font-semibold text-foreground">
												{experience.stationName}
											</span>
											<span
												className={`rounded-full px-2 py-1 text-[11px] font-medium ${getReviewBadgeClassName(experience.reviewStatus)}`}
											>
												{experience.reviewStatus}
											</span>
											<span
												className={`rounded-full px-2 py-1 text-[11px] font-medium ${getStationExperienceSentimentClassName(experience.sentiment)}`}
											>
												{getStationExperienceSentimentLabel(
													experience.sentiment,
												)}
											</span>
										</div>
										<p className="text-sm text-muted-foreground">
											{experience.stationAddress}
										</p>
										<p className="text-xs text-muted-foreground">
											Submitted by {experience.reporterLabel} on{" "}
											{new Date(experience.createdAt).toLocaleString()}
										</p>
									</div>
									{isPending ? (
										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												size="sm"
												className="bg-emerald-600 hover:bg-emerald-700"
												onClick={() => {
													setReviewNotes(
														experience.reviewNotes ?? "",
													);
													setReviewDialog({
														experience,
														nextStatus: "approved",
													});
												}}
											>
												<CheckCircle2 className="h-4 w-4" />
												Approve
											</Button>
											<Button
												type="button"
												size="sm"
												variant="destructive"
												onClick={() => {
													setReviewNotes(
														experience.reviewNotes ?? "",
													);
													setReviewDialog({
														experience,
														nextStatus: "rejected",
													});
												}}
											>
												<XCircle className="h-4 w-4" />
												Reject
											</Button>
										</div>
									) : null}
								</div>

								<p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
									{experience.experienceText}
								</p>

								{experience.photoUrls.length > 0 ? (
									<div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
										{experience.photoUrls.map((photoUrl, index) => (
											<a
												key={`${experience.id}-photo-${index}`}
												href={photoUrl}
												target="_blank"
												rel="noreferrer"
												className="overflow-hidden rounded-lg border border-border bg-background"
											>
												<img
													src={photoUrl}
													alt={
														experience.photoFilenames[index] ??
														"Station experience photo"
													}
													className="h-28 w-full object-cover"
												/>
											</a>
										))}
									</div>
								) : null}

								{experience.reviewNotes ? (
									<div className="mt-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
										<span className="font-medium text-foreground">
											Review notes:
										</span>{" "}
										{experience.reviewNotes}
									</div>
								) : null}
							</div>
						);
					})
				)}
			</div>

			<AdminListPagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
				className="mt-6"
			/>

			<Dialog
				open={Boolean(reviewDialog)}
				onOpenChange={(open) => {
					if (!open) {
						setReviewDialog(null);
						setReviewNotes("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{reviewDialog?.nextStatus === "approved"
								? "Approve experience"
								: "Reject experience"}
						</DialogTitle>
						<DialogDescription>
							Add an optional note for this moderation decision.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						value={reviewNotes}
						onChange={(event) => setReviewNotes(event.target.value)}
						placeholder="Optional review notes"
						className="min-h-28"
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setReviewDialog(null);
								setReviewNotes("");
							}}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant={
								reviewDialog?.nextStatus === "approved"
									? "default"
									: "destructive"
							}
							onClick={() => {
								if (!reviewDialog) {
									return;
								}

								reviewExperience.mutate({
									experience: reviewDialog.experience,
									nextStatus: reviewDialog.nextStatus,
									notes: reviewNotes,
								});
							}}
							disabled={reviewExperience.isPending}
						>
							{reviewExperience.isPending ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Saving...
								</>
							) : reviewDialog?.nextStatus === "approved" ? (
								"Approve Experience"
							) : (
								"Reject Experience"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

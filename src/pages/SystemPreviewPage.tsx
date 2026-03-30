import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchFilter } from "@/components/SearchFilter";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { ReviewStatusBadge } from "@/components/admin/admin-shared";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert, Loader2, BellRing, Layers3, SlidersHorizontal } from "lucide-react";
import { toast } from "@/lib/app-toast";
import type { FilterFuelType, SortOption, StatusFilter } from "@/types/station";

export default function SystemPreviewPage() {
	const { user } = useAuth();
	const { isSuperAdmin, isLoading } = useAdminRole();
	const [searchQuery, setSearchQuery] = useState("");
	const [fuelFilter, setFuelFilter] = useState<FilterFuelType>("All");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
	const [sortBy, setSortBy] = useState<SortOption>("price_asc");
	const [previewPage, setPreviewPage] = useState(1);
	const [dialogOpen, setDialogOpen] = useState(false);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!user || !isSuperAdmin) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							Super admin access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							This preview page is only available to your super-admin account.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<Layers3 className="mt-0.5 h-5 w-5 text-accent" />
					<div>
						<h2 className="text-headline text-foreground">
							System Preview
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Test toast variants and preview the common UI elements used across FuelWatch PH.
						</p>
					</div>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
				<section className="rounded-2xl bg-card p-6 shadow-sovereign">
					<div className="mb-4 flex items-start gap-3">
						<BellRing className="mt-0.5 h-5 w-5 text-accent" />
						<div>
							<h3 className="text-xl font-semibold text-foreground">
								Toast Playground
							</h3>
							<p className="text-sm text-muted-foreground">
								Preview the new success, destructive, warning, and info styling.
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-3">
						<Button onClick={() => toast.success("Profile updated successfully")}>
							Success Toast
						</Button>
						<Button
							variant="destructive"
							onClick={() =>
								toast.deleted("Station deleted", {
									description: "This removal has been completed.",
								})
							}
						>
							Delete Toast
						</Button>
						<Button
							variant="secondary"
							onClick={() =>
								toast.warning("Location needs verification", {
									description: "Review the station address before approval.",
								})
							}
						>
							Warning Toast
						</Button>
						<Button
							variant="outline"
							onClick={() =>
								toast.info("Invite link copied", {
									description: "You can now send the access link securely.",
								})
							}
						>
							Info Toast
						</Button>
						<Button
							variant="ghost"
							onClick={() =>
								toast.error("Report approval failed", {
									description: "Please try again in a few moments.",
								})
							}
						>
							Error Toast
						</Button>
					</div>
				</section>

				<section className="rounded-2xl bg-card p-6 shadow-sovereign">
					<div className="mb-4 flex items-start gap-3">
						<SlidersHorizontal className="mt-0.5 h-5 w-5 text-accent" />
						<div>
							<h3 className="text-xl font-semibold text-foreground">
								Common Badges
							</h3>
							<p className="text-sm text-muted-foreground">
								Quick visual check for the badge styles currently used in the system.
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-3">
						<StatusBadge status="Available" />
						<StatusBadge status="Low" />
						<StatusBadge status="Out" />
						<VerifiedStationBadge />
						<LguVerifiedBadge />
						<ReviewStatusBadge status="pending" />
						<ReviewStatusBadge status="approved" />
						<ReviewStatusBadge status="rejected" />
						<Badge variant="secondary">Secondary Badge</Badge>
						<Badge variant="destructive">Destructive Badge</Badge>
					</div>
				</section>
			</div>

			<section className="rounded-2xl bg-card p-6 shadow-sovereign">
				<h3 className="text-xl font-semibold text-foreground">
					Search and Filters Preview
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					This mirrors the browse filter controls used on Home and Search.
				</p>
				<div className="mt-4">
					<SearchFilter
						searchQuery={searchQuery}
						onSearchChange={setSearchQuery}
						fuelFilter={fuelFilter}
						onFuelFilterChange={setFuelFilter}
						statusFilter={statusFilter}
						onStatusFilterChange={setStatusFilter}
						sortBy={sortBy}
						onSortChange={setSortBy}
					/>
				</div>
			</section>

			<div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
				<section className="rounded-2xl bg-card p-6 shadow-sovereign">
					<h3 className="text-xl font-semibold text-foreground">
						Button and Dialog Preview
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Sanity-check action buttons and the shared confirmation dialog style.
					</p>
					<div className="mt-4 flex flex-wrap gap-3">
						<Button>Primary</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="outline">Outline</Button>
						<Button variant="destructive">Destructive</Button>
						<Button variant="ghost" onClick={() => setDialogOpen(true)}>
							Open Dialog
						</Button>
					</div>
				</section>

				<section className="rounded-2xl bg-card p-6 shadow-sovereign">
					<h3 className="text-xl font-semibold text-foreground">
						Pagination Preview
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						This uses the same compact admin pagination component.
					</p>
					<div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
						<p className="text-sm text-muted-foreground">
							Page content preview for sample item set.
						</p>
						<p className="mt-2 font-medium text-foreground">
							Showing preview page {previewPage} of 5
						</p>
					</div>
					<div className="mt-4">
						<AdminListPagination
							currentPage={previewPage}
							totalPages={5}
							onPageChange={setPreviewPage}
						/>
					</div>
				</section>
			</div>

			<AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Preview confirmation dialog</AlertDialogTitle>
						<AlertDialogDescription>
							Use this sample modal to check the dialog styling alongside the new toast themes.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
						<p className="font-semibold text-foreground">
							Sample station record
						</p>
						<p className="mt-1 text-muted-foreground">
							CPG Avenue, Tagbilaran City, Bohol
						</p>
						<p className="mt-2 text-muted-foreground">
							Diesel • ₱55.40
						</p>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => setDialogOpen(false)}>
							Looks good
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

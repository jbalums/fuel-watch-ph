import { useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useAdminInvites } from "@/hooks/useAdminOnboarding";
import { useUserAccess } from "@/hooks/useUserAccess";
import { formatAccessLevelLabel } from "@/lib/access-control";

export default function AdminInvitesPage() {
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const { data: invites = [], isLoading, error } =
		useAdminInvites(isSuperAdmin);
	const [searchQuery, setSearchQuery] = useState("");

	const filteredInvites = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		if (!normalizedQuery) {
			return invites;
		}

		return invites.filter((invite) => {
			return (
				invite.email.toLowerCase().includes(normalizedQuery) ||
				invite.fullName?.toLowerCase().includes(normalizedQuery) ||
				invite.provinceName.toLowerCase().includes(normalizedQuery) ||
				invite.cityMunicipalityName
					?.toLowerCase()
					.includes(normalizedQuery)
			);
		});
	}, [invites, searchQuery]);

	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedInvites,
		setCurrentPage,
	} = usePaginatedList(filteredInvites, searchQuery);

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
							Super-admin access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Only super admins can view official admin invites.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						Official Admin Invites
					</h3>
					<p className="text-sm text-muted-foreground">
						Track issued LGU invites, expiry dates, and usage status.
					</p>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search invites"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-72"
					/>
				</div>
			</div>

			<div className="rounded-xl bg-surface-alt p-4 text-xs text-muted-foreground">
				Invite links are only visible once at approval time. This page
				shows invite metadata and usage status for auditing.
			</div>

			<div className="mt-4 flex flex-col gap-3">
				{isLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : error ? (
					<p className="py-8 text-center text-sm text-destructive">
						{error.message}
					</p>
				) : filteredInvites.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No invites found.
					</p>
				) : (
					paginatedInvites.map((invite) => {
						const statusLabel = invite.usedAt
							? "Used"
							: new Date(invite.expiresAt).getTime() <= Date.now()
								? "Expired"
								: "Active";
						const statusClass =
							statusLabel === "Used"
								? "bg-success/15 text-success"
								: statusLabel === "Expired"
									? "bg-destructive/15 text-destructive"
									: "bg-warning/15 text-warning";

						return (
							<div
								key={invite.id}
								className="rounded-xl border border-border bg-secondary/40 p-4"
							>
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-semibold text-foreground">
												{invite.fullName ?? invite.email}
											</p>
											<span
												className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}
											>
												{statusLabel}
											</span>
										</div>
										<p className="mt-1 text-sm text-muted-foreground">
											{invite.email}
										</p>
										<p className="mt-2 text-sm text-foreground">
											{formatAccessLevelLabel(invite.role)}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{invite.cityMunicipalityName
												? `${invite.cityMunicipalityName}, ${invite.provinceName}`
												: invite.provinceName}
										</p>
										<p className="mt-2 text-xs text-muted-foreground">
											Issued {new Date(invite.createdAt).toLocaleString()} •
											Expires {new Date(invite.expiresAt).toLocaleString()}
											{invite.usedAt
												? ` • Used ${new Date(invite.usedAt).toLocaleString()}`
												: ""}
										</p>
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

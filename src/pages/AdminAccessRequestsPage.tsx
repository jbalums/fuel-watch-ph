import { useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatAccessLevelLabel } from "@/lib/access-control";
import { useAdminAccessRequests } from "@/hooks/useAdminOnboarding";
import { useUserAccess } from "@/hooks/useUserAccess";

type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";

function getStatusClasses(status: RequestStatusFilter | "pending" | "approved" | "rejected") {
	if (status === "approved") {
		return "bg-success/15 text-success";
	}

	if (status === "rejected") {
		return "bg-destructive/15 text-destructive";
	}

	return "bg-warning/15 text-warning";
}

export default function AdminAccessRequestsPage() {
	const navigate = useNavigate();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const { data: requests = [], isLoading, error } =
		useAdminAccessRequests(isSuperAdmin);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<RequestStatusFilter>("pending");

	const filteredRequests = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		return requests.filter((request) => {
			const matchesStatus =
				statusFilter === "all" || request.status === statusFilter;
			const matchesSearch =
				!normalizedQuery ||
				request.fullName.toLowerCase().includes(normalizedQuery) ||
				request.email.toLowerCase().includes(normalizedQuery) ||
				request.officeName.toLowerCase().includes(normalizedQuery) ||
				request.provinceName.toLowerCase().includes(normalizedQuery) ||
				request.cityMunicipalityName
					?.toLowerCase()
					.includes(normalizedQuery);

			return matchesStatus && matchesSearch;
		});
	}, [requests, searchQuery, statusFilter]);

	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedRequests,
		setCurrentPage,
	} = usePaginatedList(filteredRequests, `${searchQuery}::${statusFilter}`);

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
							Only super admins can review official LGU access requests.
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
						Official Access Requests
					</h3>
					<p className="text-sm text-muted-foreground">
						Review invite-only requests from city, municipality, and province officials.
					</p>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search requests"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-72"
					/>
				</div>
			</div>

			<div className="mb-4 flex flex-wrap gap-2">
				{(["pending", "approved", "rejected", "all"] as const).map(
					(filter) => (
						<button
							key={filter}
							type="button"
							onClick={() => setStatusFilter(filter)}
							className={`rounded-full px-4 py-1.5 text-sm font-medium ${
								statusFilter === filter
									? "bg-accent text-accent-foreground"
									: "bg-surface-alt text-muted-foreground hover:text-foreground"
							}`}
						>
							{filter[0].toUpperCase() + filter.slice(1)}
						</button>
					),
				)}
			</div>

			<div className="flex flex-col gap-3">
				{isLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : error ? (
					<p className="py-8 text-center text-sm text-destructive">
						{error.message}
					</p>
				) : filteredRequests.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No access requests match the current filter.
					</p>
				) : (
					paginatedRequests.map((request) => (
						<div
							key={request.id}
							className="rounded-xl border border-border bg-secondary/40 p-4"
						>
							<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-semibold text-foreground">
											{request.fullName}
										</p>
										<span
											className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
												request.status,
											)}`}
										>
											{request.status}
										</span>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{request.email} • {request.mobileNumber}
									</p>
									<p className="mt-2 text-sm text-foreground">
										{request.officeName} • {request.positionTitle}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Requested {formatAccessLevelLabel(request.requestedRole)} for{" "}
										{request.cityMunicipalityName
											? `${request.cityMunicipalityName}, ${request.provinceName}`
											: request.provinceName}
									</p>
									<p className="mt-2 text-xs text-muted-foreground">
										Submitted {new Date(request.createdAt).toLocaleString()}
									</p>
								</div>

								<button
									type="button"
									onClick={() =>
										navigate(`/admin/access-requests/${request.id}`)
									}
									className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
								>
									View request
								</button>
							</div>
						</div>
					))
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

import { motion } from "framer-motion";
import { Check, ChevronDown, Loader2, ShieldAlert } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	useAdminAccessRequests,
	useAdminInvites,
	useAdminLguUsers,
} from "@/hooks/useAdminOnboarding";
import { useAdminStationExperiences } from "@/hooks/useStationExperiences";
import { useAdminStationClaims } from "@/hooks/useStationClaims";
import { useManageableUsers } from "@/hooks/useManageableUsers";
import { cn, countNewSince } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminReports } from "@/components/admin/admin-shared";
import { PendingCountBadge } from "@/components/admin/PendingCountBadge";
import { useAdminRole } from "@/hooks/useAdminRole";

export function AdminLayout() {
	const { user } = useAuth();
	const { isAdmin, isSuperAdmin, isLoading: roleLoading } = useAdminRole();
	const location = useLocation();
	const navigate = useNavigate();
	const { data: reports = [] } = useAdminReports(isAdmin);
	const { data: experiences = [] } = useAdminStationExperiences("pending");
	const { data: claims = [] } = useAdminStationClaims(isAdmin);
	const superAdmin = isAdmin && isSuperAdmin;
	const { data: accessRequests = [] } = useAdminAccessRequests(superAdmin);
	const { data: invites = [] } = useAdminInvites(superAdmin);
	const { data: manageableUsers = [] } = useManageableUsers(superAdmin);
	const { data: lguUsers = [] } = useAdminLguUsers(superAdmin);
	const pendingReports = reports.filter(
		(report) => report.reviewStatus === "pending",
	).length;
	const pendingClaims = claims.filter(
		(claim) => claim.reviewStatus === "pending",
	).length;
	const pendingExperiences = experiences.filter(
		(experience) => experience.reviewStatus === "pending",
	).length;
	const pendingAccessRequests = accessRequests.filter(
		(request) => request.status === "pending",
	).length;
	const pendingInvites = invites.filter(
		(invite) => invite.usedAt === null,
	).length;
	const newUsers = countNewSince(manageableUsers.map((user) => user.createdAt));
	const newLguUsers = countNewSince(lguUsers.map((user) => user.createdAt));
	const baseNavItems = [
		{ label: "Overview", to: "/admin", end: true },
		{ label: "Stations", to: "/admin/stations" },
		{ label: "Stations Summary", to: "/admin/stations-summary" },
		{ label: "Station Discovery", to: "/admin/station-discovery" },
		{ label: "Brand Logos", to: "/admin/brand-logos" },
		{ label: "Donation Gateways", to: "/admin/donation-gateways" },
		{ label: "Reports", to: "/admin/reports", pendingCount: pendingReports },
		{ label: "Experiences", to: "/admin/station-experiences", pendingCount: pendingExperiences },
		{ label: "Claims", to: "/admin/claims", pendingCount: pendingClaims },
	];
	const superAdminNavItems = isSuperAdmin
		? [
				{ label: "Users", to: "/admin/users", pendingCount: newUsers },
				{ label: "LGU Users", to: "/admin/lgu-users", pendingCount: newLguUsers },
				{ label: "Platform Controls", to: "/admin/platform-controls" },
				{ label: "Access Requests", to: "/admin/access-requests", pendingCount: pendingAccessRequests },
				{ label: "Invites", to: "/admin/invites", pendingCount: pendingInvites },
				{ label: "Geo Backfill", to: "/admin/geo-backfill" },
				{ label: "AI Price Fill", to: "/admin/ai-price-fill" },
				{ label: "AI Price Analyzer", to: "/admin/ai-price-analyzer" },
				{ label: "Average Fuel Price", to: "/admin/average-fuel-price" },
				{ label: "System Preview", to: "/admin/system-preview" },
				{ label: "Live Users", to: "/admin/live-users" },
			]
		: [];
	const allNavItems = [...baseNavItems, ...superAdminNavItems];

	function isItemActive(item: { to: string; end?: boolean }) {
		if (item.end) return location.pathname === item.to;
		return location.pathname === item.to || location.pathname.startsWith(item.to + "/");
	}

	const activeItem = allNavItems.find(isItemActive);
	const totalPending = allNavItems.reduce((sum, item) => sum + (item.pendingCount ?? 0), 0);

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
						{isSuperAdmin
							? "Manage fuel stations, review community submissions, and control platform access."
							: "Manage fuel stations and review community submissions."}
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="relative inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground sovereign-ease transition-colors hover:bg-secondary/80">
							<span>{activeItem?.label ?? "Navigate"}</span>
							{totalPending > 0 && (
								<PendingCountBadge
									count={totalPending}
									className="absolute -right-1 -top-1 border-transparent px-2 py-0 text-[10px] leading-5"
								/>
							)}
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
						{baseNavItems.map((item) => (
							<DropdownMenuItem
								key={item.to}
								onClick={() => navigate(item.to)}
								className={cn(
									"flex cursor-pointer items-center justify-between",
									isItemActive(item) && "bg-primary/10 text-primary",
								)}
							>
								<span>{item.label}</span>
								<div className="flex items-center gap-1.5">
									{(item.pendingCount ?? 0) > 0 && (
										<PendingCountBadge
											count={item.pendingCount!}
											className="relative border-transparent px-2 py-0 text-[10px] leading-5"
										/>
									)}
									{isItemActive(item) && (
										<Check className="h-3.5 w-3.5 text-primary" />
									)}
								</div>
							</DropdownMenuItem>
						))}
						{isSuperAdmin && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
									Super Admin
								</DropdownMenuLabel>
								{superAdminNavItems.map((item) => (
									<DropdownMenuItem
										key={item.to}
										onClick={() => navigate(item.to)}
										className={cn(
											"flex cursor-pointer items-center justify-between",
											isItemActive(item) && "bg-primary/10 text-primary",
										)}
									>
										<span>{item.label}</span>
										<div className="flex items-center gap-1.5">
											{(item.pendingCount ?? 0) > 0 && (
												<PendingCountBadge
													count={item.pendingCount!}
													className="relative border-transparent px-2 py-0 text-[10px] leading-5"
												/>
											)}
											{isItemActive(item) && (
												<Check className="h-3.5 w-3.5 text-primary" />
											)}
										</div>
									</DropdownMenuItem>
								))}
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<Outlet />
		</motion.div>
	);
}

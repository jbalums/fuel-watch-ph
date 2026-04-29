import { motion } from "framer-motion";
import { Loader2, ShieldAlert } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAdminAccessRequests } from "@/hooks/useAdminOnboarding";
import { useAdminStationExperiences } from "@/hooks/useStationExperiences";
import { useAdminStationClaims } from "@/hooks/useStationClaims";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminReports } from "@/components/admin/admin-shared";
import { PendingCountBadge } from "@/components/admin/PendingCountBadge";
import { useAdminRole } from "@/hooks/useAdminRole";

export function AdminLayout() {
	const { user } = useAuth();
	const { isAdmin, isSuperAdmin, isLoading: roleLoading } = useAdminRole();
	const { data: reports = [] } = useAdminReports(isAdmin);
	const { data: experiences = [] } = useAdminStationExperiences("pending");
	const { data: claims = [] } = useAdminStationClaims(isAdmin);
	const { data: accessRequests = [] } = useAdminAccessRequests(
		isAdmin && isSuperAdmin,
	);
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
	const adminNavItems = [
		{ label: "Overview", to: "/admin", end: true },
		{ label: "Stations", to: "/admin/stations" },
		{ label: "Stations Summary", to: "/admin/stations-summary" },
		{ label: "Station Discovery", to: "/admin/station-discovery" },
		{ label: "Brand Logos", to: "/admin/brand-logos" },
		{ label: "Donation Gateways", to: "/admin/donation-gateways" },
		{
			label: "Reports",
			to: "/admin/reports",
			pendingCount: pendingReports,
		},
		{
			label: "Experiences",
			to: "/admin/station-experiences",
			pendingCount: pendingExperiences,
		},
		{
			label: "Claims",
			to: "/admin/claims",
			pendingCount: pendingClaims,
		},
		...(isSuperAdmin
			? [
					{ label: "Users", to: "/admin/users" },
					{ label: "LGU Users", to: "/admin/lgu-users" },
					{
						label: "Platform Controls",
						to: "/admin/platform-controls",
					},
					{
						label: "Access Requests",
						to: "/admin/access-requests",
						pendingCount: pendingAccessRequests,
					},
					{ label: "Invites", to: "/admin/invites" },
					{ label: "Geo Backfill", to: "/admin/geo-backfill" },
					{ label: "System Preview", to: "/admin/system-preview" },
				]
			: []),
	];

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
				<div className="flex flex-wrap gap-2">
					{adminNavItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.end}
							className={({ isActive }) =>
								cn(
									"inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium sovereign-ease transition-colors",
									isActive
										? "bg-primary text-primary-foreground"
										: "bg-secondary text-muted-foreground hover:text-foreground",
								)
							}
						>
							<span>{item.label}</span>
							<PendingCountBadge
								count={item.pendingCount ?? 0}
								className="border-transparent px-2 py-0 text-[10px] leading-5"
							/>
						</NavLink>
					))}
				</div>
			</div>

			<Outlet />
		</motion.div>
	);
}

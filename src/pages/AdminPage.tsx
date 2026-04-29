import { motion } from "framer-motion";
import {
	BadgeCheck,
	CheckCircle2,
	FileText,
	Fuel,
	ImagePlus,
	Loader2,
	MapPinned,
	Wallet,
	Route,
	ShieldAlert,
	UserPlus,
	Users,
	type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PendingCountBadge } from "@/components/admin/PendingCountBadge";
import { useAdminStationExperiences } from "@/hooks/useStationExperiences";
import { useAdminStationClaims } from "@/hooks/useStationClaims";
import { useAdminAccessRequests, useAdminInvites } from "@/hooks/useAdminOnboarding";
import { useUserAccess } from "@/hooks/useUserAccess";
import {
	useAdminReports,
	useAdminStations,
} from "@/components/admin/admin-shared";

type AdminSection = {
	label: string;
	description: string;
	path: string;
	icon: LucideIcon;
	pendingCount?: number;
};

export default function AdminPage() {
	const navigate = useNavigate();
	const { isSuperAdmin } = useUserAccess();
	const { data: stations = [], isLoading: stationsLoading } =
		useAdminStations();
	const { data: reports = [], isLoading: reportsLoading } = useAdminReports();
	const { data: accessRequests = [], isLoading: requestsLoading } =
		useAdminAccessRequests(isSuperAdmin);
	const { data: invites = [], isLoading: invitesLoading } =
		useAdminInvites(isSuperAdmin);
	const { data: claimRequests = [], isLoading: claimsLoading } =
		useAdminStationClaims(true);
	const { data: experiences = [], isLoading: experiencesLoading } =
		useAdminStationExperiences("pending");

	if (
		stationsLoading ||
		reportsLoading ||
		experiencesLoading ||
		claimsLoading ||
		(isSuperAdmin && (requestsLoading || invitesLoading))
	) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const pendingReports = reports.filter(
		(report) => report.reviewStatus === "pending",
	).length;
	const pendingClaims = claimRequests.filter(
		(claim) => claim.reviewStatus === "pending",
	).length;
	const pendingExperiences = experiences.filter(
		(experience) => experience.reviewStatus === "pending",
	).length;
	const reviewedReports = reports.filter(
		(report) => report.reviewStatus !== "pending",
	).length;
	const pendingAccessRequests = accessRequests.filter(
		(request) => request.status === "pending",
	).length;
	const activeInvites = invites.filter(
		(invite) => !invite.usedAt && new Date(invite.expiresAt).getTime() > Date.now(),
	).length;

	const stats = [
		{ label: "Stations", value: stations.length, icon: Fuel },
		{
			label: "Pending Reports",
			value: pendingReports,
			icon: FileText,
		},
		{
			label: "Pending Claims",
			value: pendingClaims,
			icon: ShieldAlert,
		},
		{
			label: "Reviewed Reports",
			value: reviewedReports,
			icon: CheckCircle2,
		},
		...(isSuperAdmin
			? [
					{
						label: "Pending Access Requests",
						value: pendingAccessRequests,
						icon: ShieldAlert,
					},
					{
						label: "Active Invites",
						value: activeInvites,
						icon: Users,
					},
				]
			: []),
	];

	const sections: AdminSection[] = [
		{
			label: "Stations",
			description: "Create, edit, and remove gas station records.",
			path: "/admin/stations",
			icon: Fuel,
		},
		{
			label: "Stations Summary",
			description:
				"Review a read-only table of listed stations and average fuel prices.",
			path: "/admin/stations-summary",
			icon: Fuel,
		},
		{
			label: "Station Discovery",
			description:
				"Search Google Maps for fuel stations in the current map area and prefill a new local record.",
			path: "/admin/station-discovery",
			icon: MapPinned,
		},
		{
			label: "Brand Logos",
			description:
				"Manage brand match keywords and marker logos used across station maps.",
			path: "/admin/brand-logos",
			icon: ImagePlus,
		},
		{
			label: "Donation Gateways",
			description:
				"Manage donation wallets, account details, and optional QR codes for the public Donate page.",
			path: "/admin/donation-gateways",
			icon: Wallet,
		},
		{
			label: "Reports",
			description: "Review submitted fuel updates and verification photos.",
			path: "/admin/reports",
			icon: FileText,
			pendingCount: pendingReports,
		},
		{
			label: "Experiences",
			description:
				"Review community station experience posts before they become public.",
			path: "/admin/station-experiences",
			icon: FileText,
			pendingCount: pendingExperiences,
		},
		{
			label: "Claims",
			description: "Approve or reject station ownership requests.",
			path: "/admin/claims",
			icon: BadgeCheck,
			pendingCount: pendingClaims,
		},
		...(isSuperAdmin
			? [
					{
						label: "Users",
						description:
							"Manage admin and super-admin access for platform users.",
						path: "/admin/users",
						icon: Users,
					},
					{
						label: "LGU Users",
						description:
							"View province admins, city admins, and LGU staff accounts across all scopes.",
						path: "/admin/lgu-users",
						icon: Users,
					},
					{
						label: "Platform Controls",
						description:
							"Toggle cost-sensitive map features like inline Get Directions on /map.",
						path: "/admin/platform-controls",
						icon: Route,
					},
					{
						label: "Access Requests",
						description:
							"Review official LGU access requests and generate invite links.",
						path: "/admin/access-requests",
						icon: ShieldAlert,
						pendingCount: pendingAccessRequests,
					},
					{
						label: "Invites",
						description:
							"Track issued LGU admin and staff invites with usage status.",
						path: "/admin/invites",
						icon: UserPlus,
					},
					{
						label: "Geo Backfill",
						description:
							"Assign province and city scope to older stations and fuel reports.",
						path: "/admin/geo-backfill",
						icon: MapPinned,
					},
				]
			: []),
	];

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-2 gap-3">
				{stats.map((stat, index) => (
					<motion.div
						key={stat.label}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							delay: index * 0.04,
							ease: [0.2, 0.8, 0.2, 1],
						}}
						className="rounded-xl bg-card p-5 shadow-sovereign"
					>
						<stat.icon className="h-5 w-5 text-accent" />
						<p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
							{stat.value}
						</p>
						<p className="text-label text-muted-foreground">
							{stat.label}
						</p>
					</motion.div>
				))}
			</div>

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="mb-4">
					<h3 className="text-xl font-semibold text-foreground">
						Admin Sections
					</h3>
					<p className="text-sm text-muted-foreground">
						Choose a section to continue managing FuelWatch PH.
					</p>
				</div>
				<div className="grid gap-3 md:grid-cols-3">
					{sections.map((section) => (
						<button
							key={section.path}
							onClick={() => navigate(section.path)}
							className="rounded-xl border border-border bg-secondary/40 p-4 text-left sovereign-ease transition-colors hover:bg-secondary"
						>
							<div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
								<section.icon className="h-5 w-5" />
							</div>
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold text-foreground">
									{section.label}
								</p>
								<PendingCountBadge count={section.pendingCount ?? 0} />
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								{section.description}
							</p>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

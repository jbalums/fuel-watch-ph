import { motion } from "framer-motion";
import {
	CheckCircle2,
	FileText,
	Fuel,
	Loader2,
	ShieldAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminStationClaims } from "@/hooks/useStationClaims";
import {
	useAdminReports,
	useAdminStations,
} from "@/components/admin/admin-shared";

export default function AdminPage() {
	const navigate = useNavigate();
	const { data: stations = [], isLoading: stationsLoading } =
		useAdminStations();
	const { data: reports = [], isLoading: reportsLoading } = useAdminReports();
	const { data: claimRequests = [], isLoading: claimsLoading } =
		useAdminStationClaims(true);

	if (stationsLoading || reportsLoading || claimsLoading) {
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
	const reviewedReports = reports.filter(
		(report) => report.reviewStatus !== "pending",
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
	];

	const sections = [
		{
			label: "Stations",
			description: "Create, edit, and remove gas station records.",
			path: "/admin/stations",
		},
		{
			label: "Reports",
			description: "Review submitted fuel updates and verification photos.",
			path: "/admin/reports",
		},
		{
			label: "Claims",
			description: "Approve or reject station ownership requests.",
			path: "/admin/claims",
		},
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
							<p className="font-semibold text-foreground">
								{section.label}
							</p>
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

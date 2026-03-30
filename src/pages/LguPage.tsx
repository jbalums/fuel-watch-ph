import { motion } from "framer-motion";
import { CheckCircle2, FileText, Fuel, Loader2, MapPinned } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
	useScopedDashboardStats,
} from "@/components/admin/admin-shared";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useUserAccess } from "@/hooks/useUserAccess";

function formatScopeLabel(
	provinceName: string,
	cityMunicipalityName: string | null,
	scopeType: "province" | "city",
) {
	if (scopeType === "city" && cityMunicipalityName) {
		return `${cityMunicipalityName}, ${provinceName}`;
	}

	return provinceName;
}

export default function LguPage() {
	const navigate = useNavigate();
	const { isProvinceAdmin, isCityAdmin } = useUserAccess();
	const { data: stats, isLoading: statsLoading } = useScopedDashboardStats();
	const { data: scope, isLoading: scopeLoading } = useCurrentUserScope();

	if (statsLoading || scopeLoading || !stats || !scope) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const scopeLabel = formatScopeLabel(
		scope.provinceName,
		scope.cityMunicipalityName,
		scope.scopeType,
	);
	const statCards = [
		{ label: "Stations", value: Number(stats.total_stations), icon: Fuel },
		{
			label: "Pending Reports",
			value: Number(stats.pending_reports),
			icon: FileText,
		},
		{
			label: "Reviewed Reports",
			value: Number(stats.reviewed_reports),
			icon: CheckCircle2,
		},
		{
			label: "Assigned Scope",
			value: scope.scopeType === "city" ? "City" : "Province",
			icon: MapPinned,
		},
	];
	const sections = [
		{
			label: "Scoped Stations",
			description:
				"Create and update stations inside your assigned province or city.",
			path: "/lgu/stations",
		},
		{
			label: "Scoped Reports",
			description:
				"Approve or reject community fuel reports inside your assigned area.",
			path: "/lgu/reports",
		},
		...((isProvinceAdmin || isCityAdmin)
			? [
					{
						label: "Team",
						description:
							"Invite and manage LGU staff members inside your assigned scope.",
						path: "/lgu/team",
					},
				]
			: []),
	];

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<p className="text-sm text-muted-foreground">Assigned LGU Scope</p>
				<p className="mt-1 text-xl font-semibold text-foreground">
					{scopeLabel}
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3">
				{statCards.map((stat, index) => (
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
						LGU Sections
					</h3>
					<p className="text-sm text-muted-foreground">
						Choose a section to continue managing your assigned area.
					</p>
				</div>
				<div className="grid gap-3 md:grid-cols-2">
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

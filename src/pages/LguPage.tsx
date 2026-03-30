import { motion } from "framer-motion";
import {
	CheckCircle2,
	Copy,
	ExternalLink,
	FileText,
	Fuel,
	Loader2,
	MapPinned,
	UserPlus,
	type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useScopedDashboardStats } from "@/components/admin/admin-shared";
import {
	useCurrentUserScope,
	type CurrentUserScope,
} from "@/hooks/useCurrentUserScope";
import { useUserAccess } from "@/hooks/useUserAccess";
import { toast } from "@/lib/app-toast";

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

function buildEmbedDirectUrl(scope: CurrentUserScope) {
	const directUrl = new URL("/embed/stations", window.location.origin);
	directUrl.searchParams.set("provinceCode", scope.provinceCode);

	if (scope.scopeType === "city" && scope.cityMunicipalityCode) {
		directUrl.searchParams.set(
			"cityMunicipalityCode",
			scope.cityMunicipalityCode,
		);
	}

	return directUrl.toString();
}

function buildEmbedScriptSnippet(scope: CurrentUserScope) {
	const scriptUrl = new URL(
		"/fuelwatch-stations-embed.js",
		window.location.origin,
	).toString();
	const lines = [
		'<div id="fuelwatch-stations"></div>',
		"<script",
		`  src="${scriptUrl}"`,
		`  data-base-url="${window.location.origin}"`,
		'  data-target-id="fuelwatch-stations"',
		`  data-province-code="${scope.provinceCode}"`,
	];

	if (scope.scopeType === "city" && scope.cityMunicipalityCode) {
		lines.push(
			`  data-city-municipality-code="${scope.cityMunicipalityCode}"`,
		);
	}

	lines.push('  data-height="720"', "></script>");

	return lines.join("\n");
}

type LguSection = {
	label: string;
	description: string;
	path: string;
	icon: LucideIcon;
};

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
	const embedDirectUrl = buildEmbedDirectUrl(scope);
	const embedScriptSnippet = buildEmbedScriptSnippet(scope);
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
	const sections: LguSection[] = [
		{
			label: "Scoped Stations",
			description:
				"Create and update stations inside your assigned province or city.",
			path: "/lgu/stations",
			icon: Fuel,
		},
		{
			label: "Scoped Reports",
			description:
				"Approve or reject community fuel reports inside your assigned area.",
			path: "/lgu/reports",
			icon: FileText,
		},
		...((isProvinceAdmin || isCityAdmin)
			? [
					{
						label: "Team",
						description:
							"Invite and manage LGU staff members inside your assigned scope.",
						path: "/lgu/team",
						icon: UserPlus,
					},
				]
			: []),
	];

	const copyText = async (value: string, successMessage: string) => {
		try {
			await navigator.clipboard.writeText(value);
			toast.info(successMessage);
		} catch {
			toast.error("Could not copy the embed code");
		}
	};

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
							<div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
								<section.icon className="h-5 w-5" />
							</div>
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

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div>
						<h3 className="text-xl font-semibold text-foreground">
							Embed This Station List
						</h3>
						<p className="text-sm text-muted-foreground">
							Use the scoped embed below to publish the station
							list for {scopeLabel} on another site.
						</p>
					</div>
					<a
						href={embedDirectUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground sovereign-ease transition-colors hover:bg-secondary"
					>
						<ExternalLink className="h-4 w-4" />
						Open Direct URL
					</a>
				</div>

				<div className="grid gap-4">
					<div className="rounded-xl border border-border bg-secondary/30 p-4">
						<div className="mb-3 flex items-center justify-between gap-3">
							<div>
								<p className="font-semibold text-foreground">
									Direct Embed URL
								</p>
								<p className="text-sm text-muted-foreground">
									Use this route directly in an iframe or open
									it as a standalone embedded page.
								</p>
							</div>
							<button
								type="button"
								onClick={() =>
									void copyText(
										embedDirectUrl,
										"Embedded direct URL copied",
									)
								}
								className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-sm text-foreground sovereign-ease transition-colors hover:bg-secondary"
							>
								<Copy className="h-4 w-4" />
								Copy URL
							</button>
						</div>
						<pre className="overflow-x-auto rounded-lg bg-background px-4 py-3 text-xs text-foreground">
							<code>{embedDirectUrl}</code>
						</pre>
					</div>

					<div className="rounded-xl border border-border bg-secondary/30 p-4">
						<div className="mb-3 flex items-center justify-between gap-3">
							<div>
								<p className="font-semibold text-foreground">
									Script Usage
								</p>
								<p className="text-sm text-muted-foreground">
									Copy and paste this snippet into your LGU
									website to render the embedded station list.
								</p>
							</div>
							<button
								type="button"
								onClick={() =>
									void copyText(
										embedScriptSnippet,
										"Embed script snippet copied",
									)
								}
								className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-sm text-foreground sovereign-ease transition-colors hover:bg-secondary"
							>
								<Copy className="h-4 w-4" />
								Copy Script
							</button>
						</div>
						<pre className="overflow-x-auto rounded-lg bg-background px-4 py-3 text-xs text-foreground">
							<code>{embedScriptSnippet}</code>
						</pre>
					</div>
				</div>
			</div>
		</div>
	);
}

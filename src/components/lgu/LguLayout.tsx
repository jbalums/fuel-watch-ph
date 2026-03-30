import { motion } from "framer-motion";
import { Loader2, ShieldAlert } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useUserAccess } from "@/hooks/useUserAccess";
import { cn } from "@/lib/utils";

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

export function LguLayout() {
	const { user } = useAuth();
	const {
		isLguAdmin,
		isProvinceAdmin,
		isCityAdmin,
		accessLevel,
		isLoading: accessLoading,
	} =
		useUserAccess();
	const { data: scope, isLoading: scopeLoading } = useCurrentUserScope(
		isLguAdmin,
	);

	if (accessLoading || (isLguAdmin && scopeLoading)) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!user || !isLguAdmin || !scope) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							LGU access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							This dashboard is only available to official LGU
							users with an assigned geographic scope.
						</p>
					</div>
				</div>
			</div>
		);
	}

	const navItems = [
		{ label: "Overview", to: "/lgu", end: true },
		{ label: "Stations", to: "/lgu/stations" },
		{ label: "Reports", to: "/lgu/reports" },
		...((isProvinceAdmin || isCityAdmin)
			? [{ label: "Team", to: "/lgu/team" }]
			: []),
	];
	const scopeLabel = formatScopeLabel(
		scope.provinceName,
		scope.cityMunicipalityName,
		scope.scopeType,
	);
	const roleLabel =
		accessLevel === "province_admin"
			? "Province Admin"
			: accessLevel === "city_admin"
				? "City Admin"
				: "LGU Staff";

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
						LGU Dashboard
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Review and manage fuel data for your assigned LGU scope.
					</p>
					<p className="mt-2 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
						{roleLabel} • {scopeLabel}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.end}
							className={({ isActive }) =>
								cn(
									"rounded-full px-4 py-2 text-sm font-medium sovereign-ease transition-colors",
									isActive
										? "bg-primary text-primary-foreground"
										: "bg-secondary text-muted-foreground hover:text-foreground",
								)
							}
						>
							{item.label}
						</NavLink>
					))}
				</div>
			</div>

			<Outlet />
		</motion.div>
	);
}

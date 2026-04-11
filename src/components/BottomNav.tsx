import { Home, Map, PlusCircle, Search, Shield } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
	dashboardPath?: string | null;
	dashboardLabel?: string;
	isAuthenticated?: boolean;
}

const baseTabs: {
	id: string;
	path: string;
	icon: typeof Home;
	label: string;
}[] = [
	{ id: "home", path: "/", icon: Home, label: "Home" },
	{ id: "map", path: "/map", icon: Map, label: "Map" },
	{ id: "search", path: "/search", icon: Search, label: "Search" },
	{ id: "report", path: "/report", icon: PlusCircle, label: "Report" },
];

export function BottomNav({
	dashboardPath,
	dashboardLabel = "Admin",
	isAuthenticated,
}: BottomNavProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const tabs = dashboardPath
		? [
				...baseTabs,
				{
					id: "dashboard",
					path: dashboardPath,
					icon: Shield,
					label: dashboardLabel,
				},
			]
		: baseTabs;
	const isActivePath = (path: string) => {
		if (path === "/") {
			return location.pathname === "/";
		}

		return (
			location.pathname === path ||
			location.pathname.startsWith(`${path}/`)
		);
	};

	return (
		<div className="sticky bottom-4 flex items-center justify-center pt-4">
			<nav className="bottom-4 z-50 flex gap-1 rounded-2xl p-1.5 surface-glass shadow-sovereign-lg">
				{tabs.map(({ id, path, icon: Icon, label }) => (
					<button
						key={id}
						onClick={() => {
							if (path === "/report" && !isAuthenticated) {
								navigate("/auth");
								return;
							}

							navigate({
								pathname: path,
								search: location.search,
							});
						}}
						className={cn(
							"flex flex-col items-center gap-0.5 rounded-md px-4 md:px-5 py-2 text-xs font-medium sovereign-ease transition-colors duration-300 relative",
							isActivePath(path)
								? "bg-primary text-primary-foreground border border-amber-500"
								: "text-muted-foreground dark:text-white hover:text-foreground",
						)}
					>
						<Icon className="h-5 w-5" />
						<span className="">{label}</span>
					</button>
				))}
			</nav>
		</div>
	);
}

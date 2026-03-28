import { Home, Map, PlusCircle, Search, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "home" | "map" | "search" | "report" | "admin";

interface BottomNavProps {
	active: Tab;
	onChange: (tab: Tab) => void;
	isAdmin?: boolean;
}

const baseTabs: {
	id: Tab;
	icon: typeof Home;
	label: string;
	adminOnly?: boolean;
}[] = [
	{ id: "home", icon: Home, label: "Home" },
	{ id: "map", icon: Map, label: "Map" },
	{ id: "search", icon: Search, label: "Search" },
	{ id: "report", icon: PlusCircle, label: "Report" },
	{ id: "admin", icon: Shield, label: "Admin", adminOnly: true },
];

export function BottomNav({ active, onChange, isAdmin }: BottomNavProps) {
	const tabs = baseTabs.filter((t) => !t.adminOnly || isAdmin);

	return (
		<div className="sticky bottom-4 flex items-center justify-center pt-4">
			<nav className=" bottom-4 z-50 flex gap-1 rounded-2xl p-1.5 surface-glass shadow-sovereign-lg">
				{tabs.map(({ id, icon: Icon, label }) => (
					<button
						key={id}
						onClick={() => onChange(id)}
						className={cn(
							"flex flex-col items-center gap-0.5 rounded-md px-4 md:px-5 py-2 text-xs font-medium sovereign-ease transition-colors duration-300",
							active === id
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className="h-5 w-5" />
						<span>{label}</span>
					</button>
				))}
			</nav>
		</div>
	);
}

import { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { HeroStatus } from "@/components/HeroStatus";
import { AlertBanner } from "@/components/AlertBanner";
import { StationCard } from "@/components/StationCard";
import { SearchFilter } from "@/components/SearchFilter";
import { ReportForm } from "@/components/ReportForm";
import { StationMap } from "@/components/StationMap";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { mockAlerts } from "@/data/mockStations";
import { FilterFuelType, SortOption } from "@/types/station";
import { useAuth } from "@/contexts/AuthContext";
import { useStations } from "@/hooks/useStations";
import { Fuel, LogIn, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAdminRole } from "@/hooks/useAdminRole";

type Tab = "home" | "map" | "search" | "report" | "admin";

export default function Index() {
	const { user, signOut } = useAuth();
	const { isAdmin } = useAdminRole();
	const navigate = useNavigate();
	const { data: stations = [], isLoading: stationsLoading } = useStations();
	const [tab, setTab] = useState<Tab>("home");
	const [searchQuery, setSearchQuery] = useState("");
	const [fuelFilter, setFuelFilter] = useState<FilterFuelType>("All");
	const [sortBy, setSortBy] = useState<SortOption>("cheapest");

	const filteredStations = useMemo(() => {
		let list = [...stations];
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(s) =>
					s.name.toLowerCase().includes(q) ||
					s.address.toLowerCase().includes(q),
			);
		}
		if (fuelFilter !== "All") {
			list = list.filter((s) => s.fuelType === fuelFilter);
		}
		if (sortBy === "cheapest") {
			list.sort((a, b) => {
				if (a.status === "Out") return 1;
				if (b.status === "Out") return -1;
				return a.pricePerLiter - b.pricePerLiter;
			});
		} else if (sortBy === "status") {
			const order = { Available: 0, Low: 1, Out: 2 };
			list.sort((a, b) => order[a.status] - order[b.status]);
		}
		return list;
	}, [stations, searchQuery, fuelFilter, sortBy]);

	const handleTabChange = (t: Tab) => {
		if ((t === "report" || t === "admin") && !user) {
			navigate("/auth");
			return;
		}
		setTab(t);
	};

	return (
		<div className="min-h-screen bg-background pb-24">
			<header className="sticky top-0 z-40 surface-glass px-5 py-4">
				<div className="container flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
							<Fuel className="h-5 w-5 text-primary-foreground" />
						</div>
						<div>
							<h1 className="text-base font-bold text-foreground tracking-tight">
								FuelWatch PH
							</h1>
							<p className="text-xs text-muted-foreground">
								Real-time fuel tracking
							</p>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<ThemeToggle />
						{user ? (
							<button
								onClick={() => navigate("/profile")}
								className="sovereign-ease transition-transform hover:scale-105 flex items-center gap-2"
							>
								<Avatar className="h-8 w-8 ring-1 ring-border">
									<AvatarImage
										src={user.user_metadata?.avatar_url}
									/>
									<AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
										{(
											user.user_metadata?.display_name ||
											user.email ||
											"?"
										)
											.slice(0, 2)
											.toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="text-sm font-bold text-primary">
									{user.user_metadata?.name}
								</span>
							</button>
						) : (
							<button
								onClick={() => navigate("/auth")}
								className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground sovereign-ease hover:bg-primary-hover transition-colors"
							>
								<LogIn className="h-3.5 w-3.5" />
								Sign in
							</button>
						)}
					</div>
				</div>
			</header>

			<main className="container flex flex-col gap-5 px-5 pt-5">
				{tab === "home" && (
					<>
						<HeroStatus stations={stations} />
						<AlertBanner alerts={mockAlerts} />
						<SearchFilter
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							fuelFilter={fuelFilter}
							onFuelFilterChange={setFuelFilter}
							sortBy={sortBy}
							onSortChange={setSortBy}
						/>
						<div className="flex flex-col gap-3">
							<div>
								⚠️ Prices and availability are based on user
								reports and may vary. Please verify at the
								station before refueling.
							</div>
							{stationsLoading ? (
								<div className="flex items-center justify-center py-10">
									<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								</div>
							) : (
								<>
									<AnimatePresence mode="popLayout">
										{filteredStations.map((station, i) => (
											<StationCard
												key={station.id}
												station={station}
												index={i}
											/>
										))}
									</AnimatePresence>
									{filteredStations.length === 0 && (
										<p className="py-10 text-center text-sm text-muted-foreground">
											No stations found matching your
											criteria.
										</p>
									)}
								</>
							)}
						</div>
					</>
				)}

				{tab === "map" && <StationMap stations={stations} />}

				{tab === "search" && (
					<>
						<SearchFilter
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							fuelFilter={fuelFilter}
							onFuelFilterChange={setFuelFilter}
							sortBy={sortBy}
							onSortChange={setSortBy}
						/>
						<div className="flex flex-col gap-3">
							<div>
								⚠️ Prices and availability are based on user
								reports and may vary. Please verify at the
								station before refueling.
							</div>
							<AnimatePresence mode="popLayout">
								{filteredStations.map((station, i) => (
									<StationCard
										key={station.id}
										station={station}
										index={i}
									/>
								))}
							</AnimatePresence>
						</div>
					</>
				)}

				{tab === "report" && <ReportForm />}
				{tab === "admin" && isAdmin && <AdminDashboard />}
			</main>

			<BottomNav
				active={tab}
				onChange={handleTabChange}
				isAdmin={isAdmin}
			/>
		</div>
	);
}

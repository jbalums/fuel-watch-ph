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
import {
	FilterFuelType,
	FuelType,
	GasStation,
	SortOption,
	StatusFilter,
} from "@/types/station";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useStations } from "@/hooks/useStations";
import { Fuel, LogIn, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAdminRole } from "@/hooks/useAdminRole";
import logo from "@/assets/images/Icon.png";

type Tab = "home" | "map" | "search" | "report" | "admin";

function hasValidFuelPrice(station: GasStation, fuelType: FuelType) {
	const price = station.prices[fuelType];
	return typeof price === "number" && Number.isFinite(price) && price > 0;
}

function getFuelSortPrice(station: GasStation, fuelFilter: FilterFuelType) {
	return station.prices[fuelFilter] ?? Number.POSITIVE_INFINITY;
}

function formatCompactUserName(rawName: string) {
	const parts = rawName.trim().split(/\s+/).filter(Boolean);

	if (parts.length === 0) {
		return "";
	}

	if (parts.length === 1) {
		return parts[0];
	}

	return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

function capHeaderName(name: string, maxLength = 10) {
	if (name.length <= maxLength) {
		return name;
	}

	return `${name.slice(0, maxLength - 1).trimEnd()}…`;
}

function getUserNameFallback(email?: string | null) {
	if (!email) {
		return "";
	}

	return email.split("@")[0] || email;
}

export default function Index() {
	const { user } = useAuth();
	const { data: profile } = useProfile();
	const { isAdmin } = useAdminRole();
	const navigate = useNavigate();
	const { data: stations = [], isLoading: stationsLoading } = useStations();
	const [tab, setTab] = useState<Tab>("home");
	const [searchQuery, setSearchQuery] = useState("");
	const [fuelFilter, setFuelFilter] = useState<FilterFuelType>("All");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
	const [sortBy, setSortBy] = useState<SortOption>("price_asc");
	const rawHeaderName =
		profile?.displayName ||
		user?.user_metadata?.display_name ||
		user?.user_metadata?.name ||
		getUserNameFallback(user?.email) ||
		"";
	const compactUserName = capHeaderName(formatCompactUserName(rawHeaderName));
	const avatarLabel =
		profile?.displayName ||
		user?.user_metadata?.display_name ||
		user?.user_metadata?.name ||
		getUserNameFallback(user?.email) ||
		"?";

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
		if (statusFilter !== "All") {
			list = list.filter((station) => station.status === statusFilter);
		}
		if (fuelFilter !== "All") {
			list = list.filter((station) =>
				hasValidFuelPrice(station, fuelFilter),
			);
		}
		if (fuelFilter === "All") {
			list.sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() -
					new Date(a.updatedAt).getTime(),
			);
		} else {
			list.sort((a, b) => {
				if (a.status === "Out") return 1;
				if (b.status === "Out") return -1;

				const priceDelta =
					getFuelSortPrice(a, fuelFilter) -
					getFuelSortPrice(b, fuelFilter);

				return sortBy === "price_desc" ? priceDelta * -1 : priceDelta;
			});
		}
		return list;
	}, [stations, searchQuery, fuelFilter, sortBy, statusFilter]);

	const handleTabChange = (t: Tab) => {
		if ((t === "report" || t === "admin") && !user) {
			navigate("/auth");
			return;
		}
		setTab(t);
	};

	const handleLogoClick = () => {
		navigate("/");
		setTab("home");
	};

	return (
		<div className="min-h-screen bg-background pb-8">
			<header className="sticky top-0 z-40 surface-glass px-1 md:px-5 py-4">
				<div className="container flex items-center justify-between">
					<button
						type="button"
						onClick={handleLogoClick}
						className="flex items-center gap-0 rounded-xl text-left sovereign-ease transition-opacity hover:opacity-90"
					>
						<div className="flex h-9 w-9 items-center justify-center">
							<img src={logo} className="h-9 w-12" />
						</div>
						<div>
							<h1 className="text-base font-bold text-foreground tracking-tight">
								<span className="text-primary">FuelWatch</span>{" "}
								<span className="text-amber-600">PH</span>
							</h1>
							<p className="text-[10px] text-muted-foreground">
								Know before you fill up
							</p>
						</div>
					</button>
					<div className="flex items-center gap-3">
						<ThemeToggle />
						{user ? (
							<button
								onClick={() => navigate("/profile")}
								className="sovereign-ease transition-transform hover:scale-105 flex items-center gap-1"
							>
								<Avatar className="h-8 w-8 ring-1 ring-border">
									<AvatarImage
										src={
											profile?.avatarUrl ||
											user.user_metadata?.avatar_url
										}
									/>
									<AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
										{avatarLabel.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="text-sm font-bold text-primary">
									{compactUserName}
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
							statusFilter={statusFilter}
							onStatusFilterChange={setStatusFilter}
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

				{tab === "map" && (
					<div className="h-screen">
						<StationMap stations={stations} />
					</div>
				)}

				{tab === "search" && (
					<>
						<SearchFilter
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							fuelFilter={fuelFilter}
							onFuelFilterChange={setFuelFilter}
							statusFilter={statusFilter}
							onStatusFilterChange={setStatusFilter}
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

import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BottomNav } from "@/components/BottomNav";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useProfile } from "@/hooks/useProfile";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useUserAccess } from "@/hooks/useUserAccess";
import { getDashboardPathForAccessLevel } from "@/lib/access-control";
import {
	CURRENT_PROVINCE_CHANGED_EVENT,
	getStoredCurrentProvinceCode,
} from "@/lib/current-province";
import { LogIn, MapPin, Moon, Sun } from "lucide-react";
import logo from "@/assets/images/fuelwatch-ph-icon.png";
import { useTheme } from "@/contexts/ThemeContext";

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

export function AppShellLayout() {
	const { theme, toggleTheme } = useTheme();
	const { user, signOut } = useAuth();
	const { data: profile } = useProfile();
	const {
		accessLevel,
		isLoading: accessLoading,
		isLguOperator,
	} = useUserAccess();
	const { data: currentUserScope } = useCurrentUserScope(
		!accessLoading && isLguOperator,
	);
	const { provinces } = useGeoReferences();
	const navigate = useNavigate();
	const location = useLocation();
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
	const [storedProvinceCode, setStoredProvinceCode] = useState(() =>
		getStoredCurrentProvinceCode(),
	);
	const dashboardPath =
		!accessLoading && accessLevel !== "user"
			? getDashboardPathForAccessLevel(accessLevel)
			: null;
	const dashboardLabel =
		accessLevel === "province_admin" ||
		accessLevel === "city_admin" ||
		accessLevel === "lgu_staff"
			? "LGU"
			: "Admin";

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

	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, [location.pathname]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const syncStoredProvinceCode = () => {
			setStoredProvinceCode(getStoredCurrentProvinceCode());
		};

		syncStoredProvinceCode();
		window.addEventListener(
			CURRENT_PROVINCE_CHANGED_EVENT,
			syncStoredProvinceCode as EventListener,
		);
		window.addEventListener("storage", syncStoredProvinceCode);

		return () => {
			window.removeEventListener(
				CURRENT_PROVINCE_CHANGED_EVENT,
				syncStoredProvinceCode as EventListener,
			);
			window.removeEventListener("storage", syncStoredProvinceCode);
		};
	}, []);

	const handleLogoClick = () => {
		navigate({
			pathname: "/",
			search: location.search,
		});
	};

	const handleConfirmLogout = async () => {
		await signOut();
		setLogoutConfirmOpen(false);
		navigate("/");
	};

	const handleChangeCurrentProvince = () => {
		navigate(
			{
				pathname: "/",
				search: location.pathname === "/" ? location.search : "",
			},
			{
				state: {
					openProvincePrompt: true,
				},
			},
		);
	};

	const publicProvinceName =
		provinces.find((province) => province.code === storedProvinceCode)
			?.name ?? "";
	const headerProvinceName = isLguOperator
		? (currentUserScope?.provinceName ?? publicProvinceName)
		: publicProvinceName;
	const headerProvinceLabel = headerProvinceName.trim() || "Change Province";
	const headerProvinceTitle = headerProvinceName.trim()
		? `Current province: ${headerProvinceName}`
		: "Change current province";

	return (
		<div className="min-h-screen bg-background pb-8">
			<header className="sticky top-0 z-40 surface-glass px-1 py-4 md:px-5">
				<div className="container flex items-center justify-between">
					<button
						type="button"
						onClick={handleLogoClick}
						className="flex items-center gap-0 rounded-xl text-left sovereign-ease transition-opacity hover:opacity-90"
					>
						<div className="flex h-9 w-9 items-center justify-center">
							<img src={logo} className="w-6" />
						</div>
						<div>
							<h1 className="text-xs md:text-base font-bold tracking-tight text-foreground">
								<span className="text-primary">FuelWatch</span>{" "}
								<span className="text-amber-600">PH</span>
							</h1>
							<p className="text-[8px] md:text-[10px] text-muted-foreground">
								Know before you fill up
							</p>
						</div>
					</button>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={handleChangeCurrentProvince}
							className="relative flex h-8 px-1 lg:px-2 gap-1 items-center justify-center rounded-sm bg-background/60 dark:bg-background/10 border border-dashed border-primary text-foreground sovereign-ease hover:bg-muted transition-colors"
							aria-label={headerProvinceTitle}
							title={headerProvinceTitle}
						>
							<MapPin className="h-3 w-3" />
							<span className="hidden md:block text-[10px]">
								{headerProvinceLabel}
							</span>
						</button>
						<ThemeToggle />
						{user ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button className="flex items-center gap-1 outline-none sovereign-ease transition-transform hover:scale-105">
										<Avatar className="h-8 w-8 ring-1 ring-border shadow-[0_0_0_2px] shadow-primary dark:shadow-sky-500">
											<AvatarImage
												src={
													profile?.avatarUrl ||
													user.user_metadata
														?.avatar_url
												}
											/>
											<AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
												{avatarLabel
													.slice(0, 2)
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										{/* <span className="text-sm font-bold text-primary">
											{avatarLabel
													.slice(0, 2)
													.toUpperCase()}
										</span> */}
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-44"
								>
									<DropdownMenuItem
										onClick={() => navigate("/profile")}
									>
										My profile
									</DropdownMenuItem>

									<DropdownMenuItem
										onSelect={() =>
											setLogoutConfirmOpen(true)
										}
									>
										Logout
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<>
								<button
									onClick={() => navigate("/auth")}
									className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground sovereign-ease transition-colors hover:bg-primary-hover"
								>
									<LogIn className="h-3.5 w-3.5" />
									Sign in
								</button>
							</>
						)}
					</div>
				</div>
			</header>

			<AlertDialog
				open={logoutConfirmOpen}
				onOpenChange={setLogoutConfirmOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Log out?</AlertDialogTitle>
						<AlertDialogDescription>
							You’ll be signed out of FuelWatch PH on this device.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => void handleConfirmLogout()}
						>
							Logout
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<main className="container flex flex-col gap-5 px-5 pt-1 lg:pt-5">
				<Outlet />
			</main>

			<BottomNav
				dashboardPath={dashboardPath}
				dashboardLabel={dashboardLabel}
				isAuthenticated={!!user}
			/>
		</div>
	);
}

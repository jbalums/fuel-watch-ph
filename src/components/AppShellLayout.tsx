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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { LogIn } from "lucide-react";
import logo from "@/assets/images/Icon.png";

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
	const { user, signOut } = useAuth();
	const { data: profile } = useProfile();
	const { isAdmin } = useAdminRole();
	const navigate = useNavigate();
	const location = useLocation();
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

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
							<img src={logo} className="h-9 w-12" />
						</div>
						<div>
							<h1 className="text-base font-bold tracking-tight text-foreground">
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
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button className="flex items-center gap-1 outline-none sovereign-ease transition-transform hover:scale-105">
										<Avatar className="h-8 w-8 ring-1 ring-border">
											<AvatarImage
												src={
													profile?.avatarUrl ||
													user.user_metadata?.avatar_url
												}
											/>
											<AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
												{avatarLabel
													.slice(0, 2)
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="text-sm font-bold text-primary">
											{compactUserName}
										</span>
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
							<button
								onClick={() => navigate("/auth")}
								className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground sovereign-ease transition-colors hover:bg-primary-hover"
							>
								<LogIn className="h-3.5 w-3.5" />
								Sign in
							</button>
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

			<main className="container flex flex-col gap-5 px-5 pt-5">
				<Outlet />
			</main>

			<BottomNav isAdmin={isAdmin} isAuthenticated={!!user} />
		</div>
	);
}

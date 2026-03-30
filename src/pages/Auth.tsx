import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { getDashboardPathForAccessLevel } from "@/lib/access-control";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/images/logo.png";
export default function Auth() {
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useAuth();
	const { accessLevel, isLoading: accessLoading } = useUserAccess();
	const [isSignUp, setIsSignUp] = useState(false);
	const [isRecoveryMode, setIsRecoveryMode] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [loading, setLoading] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);
	const [sendingResetEmail, setSendingResetEmail] = useState(false);
	const [updatingPassword, setUpdatingPassword] = useState(false);

	const searchParams = useMemo(
		() => new URLSearchParams(location.search),
		[location.search],
	);
	const hashParams = useMemo(
		() =>
			new URLSearchParams(
				location.hash.startsWith("#")
					? location.hash.slice(1)
					: location.hash,
			),
		[location.hash],
	);
	const hasRecoveryIntent =
		searchParams.get("mode") === "reset" ||
		hashParams.get("type") === "recovery";

	useEffect(() => {
		if (hasRecoveryIntent) {
			setIsRecoveryMode(true);
			setIsSignUp(false);
		}
	}, [hasRecoveryIntent]);

	useEffect(() => {
		if (user && !isRecoveryMode && !accessLoading) {
			navigate(getDashboardPathForAccessLevel(accessLevel), {
				replace: true,
			});
		}
	}, [accessLevel, accessLoading, user, isRecoveryMode, navigate]);

	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event) => {
			if (event === "PASSWORD_RECOVERY") {
				setIsRecoveryMode(true);
				setIsSignUp(false);
			}
		});

		return () => subscription.unsubscribe();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		if (isSignUp) {
			const { error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: { display_name: displayName },
					emailRedirectTo: window.location.origin,
				},
			});
			if (error) {
				toast.error(error.message);
			} else {
				toast.success("Check your email to confirm your account!");
			}
		} else {
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			if (error) {
				toast.error(error.message);
			}
		}

		setLoading(false);
	};

	const handleSendResetEmail = async () => {
		const normalizedEmail = email.trim();
		if (!normalizedEmail || !normalizedEmail.includes("@")) {
			toast.error("Enter your email address first");
			return;
		}

		setSendingResetEmail(true);
		const { error } = await supabase.auth.resetPasswordForEmail(
			normalizedEmail,
			{
				redirectTo: `${window.location.origin}/auth?mode=reset`,
			},
		);

		if (error) {
			toast.error(error.message);
		} else {
			toast.success("Check your email for the password reset link");
		}

		setSendingResetEmail(false);
	};

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault();

		if (newPassword.length < 6) {
			toast.error("Password must be at least 6 characters");
			return;
		}

		if (newPassword !== confirmNewPassword) {
			toast.error("Passwords do not match");
			return;
		}

		if (!user) {
			toast.error("Open the password reset link from your email again");
			return;
		}

		setUpdatingPassword(true);
		const { error } = await supabase.auth.updateUser({
			password: newPassword,
		});

		if (error) {
			toast.error(error.message);
			setUpdatingPassword(false);
			return;
		}

		toast.success("Password updated. Please sign in.");
		setNewPassword("");
		setConfirmNewPassword("");
		await supabase.auth.signOut();
		setIsRecoveryMode(false);
		navigate("/auth", { replace: true });
		setUpdatingPassword(false);
	};
	const signInWithGoogle = async () => {
		setGoogleLoading(true);
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo:
					window.location.hostname === "localhost"
						? "http://localhost:8080/"
						: "https://fuelwatchph.com/",
			},
		});

		if (error) {
			toast.error(error.message);
			setGoogleLoading(false);
		}
	};

	const handleLogoClick = () => {
		navigate("/");
	};

	const handleExitRecoveryMode = async () => {
		setNewPassword("");
		setConfirmNewPassword("");
		setIsRecoveryMode(false);
		await supabase.auth.signOut();
		navigate("/auth", { replace: true });
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-5">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ease: [0.2, 0.8, 0.2, 1] }}
				className="w-full max-w-sm"
			>
				{/* Logo */}
				<div
					className="mb-8 flex flex-col items-center gap-3 cursor-pointer"
					onClick={handleLogoClick}
				>
					<div className="flex h-28 w-32 items-center justify-center rounded-2xl bg-white shadow-sm">
						{/* <Fuel className="h-7 w-7 text-primary-foreground" /> */}
						<img src={logo} className="h-24 w-24" />
					</div>
					<h1 className="text-headline text-foreground">
						FuelWatch PH
					</h1>
					<p className="text-sm text-muted-foreground">
						{isRecoveryMode
							? "Set a new password"
							: isSignUp
							? "Create your account"
							: "Sign in to continue"}
					</p>
				</div>

				{isRecoveryMode ? (
					<form
						onSubmit={handleUpdatePassword}
						className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sovereign"
					>
						<p className="text-sm text-muted-foreground">
							Enter your new password below. This will replace the
							old password for your email login.
						</p>

						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								New Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="password"
									value={newPassword}
									onChange={(e) =>
										setNewPassword(e.target.value)
									}
									placeholder="••••••••"
									required
									minLength={6}
									className="w-full rounded-xl bg-surface-alt py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
								/>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Confirm New Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="password"
									value={confirmNewPassword}
									onChange={(e) =>
										setConfirmNewPassword(e.target.value)
									}
									placeholder="••••••••"
									required
									minLength={6}
									className="w-full rounded-xl bg-surface-alt py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
								/>
							</div>
						</div>

						<motion.button
							whileTap={{ scale: 0.97 }}
							type="submit"
							disabled={updatingPassword}
							className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground sovereign-ease hover:bg-primary-hover transition-colors disabled:opacity-50"
						>
							{updatingPassword
								? "Updating Password..."
								: "Set New Password"}
							<ArrowRight className="h-4 w-4" />
						</motion.button>

						<button
							type="button"
							onClick={() => void handleExitRecoveryMode()}
							className="text-sm font-medium text-accent hover:underline"
						>
							Back to sign in
						</button>
					</form>
				) : (
					<>
						<form
							onSubmit={handleSubmit}
							className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sovereign"
						>
							{isSignUp && (
								<div className="flex flex-col gap-1.5">
									<label className="text-label text-muted-foreground">
										Display Name
									</label>
									<div className="relative">
										<User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
										<input
											type="text"
											value={displayName}
											onChange={(e) =>
												setDisplayName(e.target.value)
											}
											placeholder="Juan Dela Cruz"
											className="w-full rounded-xl bg-surface-alt py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
										/>
									</div>
								</div>
							)}

							<div className="flex flex-col gap-1.5">
								<label className="text-label text-muted-foreground">
									Email
								</label>
								<div className="relative">
									<Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<input
										type="email"
										value={email}
										onChange={(e) =>
											setEmail(e.target.value)
										}
										placeholder="you@example.com"
										required
										className="w-full rounded-xl bg-surface-alt py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
									/>
								</div>
							</div>

							<div className="flex flex-col gap-1.5">
								<label className="text-label text-muted-foreground">
									Password
								</label>
								<div className="relative">
									<Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<input
										type="password"
										value={password}
										onChange={(e) =>
											setPassword(e.target.value)
										}
										placeholder="••••••••"
										required
										minLength={6}
										className="w-full rounded-xl bg-surface-alt py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
									/>
								</div>
							</div>

							{!isSignUp && (
								<button
									type="button"
									onClick={() => void handleSendResetEmail()}
									disabled={sendingResetEmail}
									className="self-end text-sm font-medium text-accent hover:underline disabled:opacity-60"
								>
									{sendingResetEmail
										? "Sending reset link..."
										: "Forgot password?"}
								</button>
							)}

							<motion.button
								whileTap={{ scale: 0.97 }}
								type="submit"
								disabled={loading}
								className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground sovereign-ease hover:bg-primary-hover transition-colors disabled:opacity-50"
							>
								{loading
									? "Please wait..."
									: isSignUp
										? "Create Account"
										: "Sign In"}
								<ArrowRight className="h-4 w-4" />
							</motion.button>
						</form>

						<div className="mt-4 flex items-center gap-3">
							<div className="h-px flex-1 bg-border" />
							<span className="text-xs text-muted-foreground">
								or
							</span>
							<div className="h-px flex-1 bg-border" />
						</div>

						<motion.button
							whileTap={{ scale: 0.97 }}
							onClick={signInWithGoogle}
							disabled={googleLoading}
							className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-card py-3.5 font-medium text-foreground shadow-sovereign sovereign-ease hover:bg-muted transition-colors disabled:opacity-50"
						>
							<svg className="h-5 w-5" viewBox="0 0 24 24">
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							{googleLoading
								? "Connecting..."
								: "Continue with Google"}
						</motion.button>

						<p className="mt-5 text-center text-sm text-muted-foreground">
							{isSignUp
								? "Already have an account?"
								: "Don't have an account?"}{" "}
							<button
								onClick={() => setIsSignUp(!isSignUp)}
								className="font-medium text-accent hover:underline"
							>
								{isSignUp ? "Sign in" : "Sign up"}
							</button>
						</p>

						<p className="mt-2 text-center text-sm text-muted-foreground">
							LGU official requesting access?{" "}
							<button
								type="button"
								onClick={() => navigate("/admin-access-request")}
								className="font-medium text-accent hover:underline"
							>
								Request official admin access
							</button>
						</p>
					</>
				)}
			</motion.div>
		</div>
	);
}

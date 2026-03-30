import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/lib/app-toast";
import logo from "@/assets/images/Icon.png";
import { useAuth } from "@/contexts/AuthContext";
import { useValidatedAdminInvite } from "@/hooks/useAdminOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { formatAccessLevelLabel, getDashboardPathForAccessLevel } from "@/lib/access-control";

type PendingInviteRegistration = {
	fullName: string;
	username: string;
};

export default function AdminInviteRegistrationPage() {
	const navigate = useNavigate();
	const { token = "" } = useParams();
	const { user, loading: authLoading } = useAuth();
	const { data: invite, isLoading, error, refetch } =
		useValidatedAdminInvite(token);
	const [username, setUsername] = useState("");
	const [fullName, setFullName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [completingInvite, setCompletingInvite] = useState(false);
	const [inviteComplete, setInviteComplete] = useState(false);
	const autoConsumeAttemptedRef = useRef(false);
	const pendingStorageKey = useMemo(
		() => `pending-admin-invite:${token}`,
		[token],
	);

	useEffect(() => {
		if (invite?.fullName && !fullName.trim()) {
			setFullName(invite.fullName);
		}
	}, [fullName, invite?.fullName]);

	const consumeInvite = async (
		nextFullName: string,
		nextUsername: string,
	) => {
		setCompletingInvite(true);

		try {
			const { data, error: consumeError } = await supabase.rpc(
				"consume_admin_invite",
				{
					_token: token,
					_full_name: nextFullName,
					_username: nextUsername,
				},
			);

			if (consumeError) {
				throw consumeError;
			}

			localStorage.removeItem(pendingStorageKey);
			setInviteComplete(true);
			toast.success("Official admin access activated");
			navigate(
				getDashboardPathForAccessLevel(
					data as
						| "province_admin"
						| "city_admin"
						| "admin"
						| "super_admin"
						| "user",
				),
				{ replace: true },
			);
		} finally {
			setCompletingInvite(false);
		}
	};

	useEffect(() => {
		if (
			!invite ||
			!user ||
			autoConsumeAttemptedRef.current ||
			user.email?.toLowerCase() !== invite.email.toLowerCase()
		) {
			return;
		}

		const storedValue = localStorage.getItem(pendingStorageKey);
		let parsed: PendingInviteRegistration | null = null;
		if (storedValue) {
			try {
				parsed = JSON.parse(storedValue) as PendingInviteRegistration;
			} catch {
				localStorage.removeItem(pendingStorageKey);
			}
		}
		const fallbackUsername =
			parsed?.username || user.user_metadata?.username || "";
		const fallbackFullName =
			parsed?.fullName ||
			user.user_metadata?.display_name ||
			invite.fullName ||
			"";

		if (!fallbackUsername || !fallbackFullName) {
			return;
		}

		autoConsumeAttemptedRef.current = true;
		void consumeInvite(fallbackFullName, fallbackUsername).catch((consumeError) => {
			autoConsumeAttemptedRef.current = false;
			toast.error(
				consumeError instanceof Error
					? consumeError.message
					: "Could not complete the invite",
			);
		});
	}, [invite, pendingStorageKey, token, user]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!invite) {
			return;
		}

		const normalizedUsername = username.trim();
		const normalizedFullName = (fullName.trim() || invite.fullName || "").trim();

		if (!normalizedUsername) {
			toast.error("Username is required");
			return;
		}

		if (!normalizedFullName) {
			toast.error("Full name is required");
			return;
		}

		if (password.length < 6) {
			toast.error("Password must be at least 6 characters");
			return;
		}

		if (password !== confirmPassword) {
			toast.error("Passwords do not match");
			return;
		}

		if (user && user.email?.toLowerCase() !== invite.email.toLowerCase()) {
			toast.error(
				`Please sign out first. This invite is only valid for ${invite.email}.`,
			);
			return;
		}

		localStorage.setItem(
			pendingStorageKey,
			JSON.stringify({
				fullName: normalizedFullName,
				username: normalizedUsername,
			} satisfies PendingInviteRegistration),
		);

		if (user && user.email?.toLowerCase() === invite.email.toLowerCase()) {
			try {
				await consumeInvite(normalizedFullName, normalizedUsername);
			} catch (consumeError) {
				toast.error(
					consumeError instanceof Error
						? consumeError.message
						: "Could not complete the invite",
				);
			}
			return;
		}

		setCompletingInvite(true);

		const { data, error: signUpError } = await supabase.auth.signUp({
			email: invite.email,
			password,
			options: {
				data: {
					display_name: normalizedFullName,
					username: normalizedUsername,
				},
				emailRedirectTo: `${window.location.origin}/admin-invite/${token}`,
			},
		});

		if (signUpError) {
			localStorage.removeItem(pendingStorageKey);
			toast.error(signUpError.message);
			setCompletingInvite(false);
			return;
		}

		if (data.user && data.session) {
			try {
				await consumeInvite(normalizedFullName, normalizedUsername);
			} catch (consumeError) {
				toast.error(
					consumeError instanceof Error
						? consumeError.message
						: "Could not complete the invite",
				);
				setCompletingInvite(false);
			}
			return;
		}

		toast.success(
			"Check your email to confirm this account, then return to this invite link to finish onboarding.",
		);
		setCompletingInvite(false);
	};

	return (
		<div className="min-h-screen bg-background px-5 py-8">
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<header className="sticky top-0 z-40 surface-glass px-1 py-4">
					<div className="container flex items-center justify-between">
						<button
							type="button"
							onClick={() => navigate("/auth")}
							className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground transition-colors hover:text-foreground"
						>
							<ArrowLeft className="h-5 w-5" />
						</button>
						<button
							type="button"
							onClick={() => navigate("/")}
							className="flex items-center gap-0 rounded-xl text-left transition-opacity hover:opacity-90"
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
					</div>
				</header>

				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ ease: [0.2, 0.8, 0.2, 1] }}
					className="rounded-2xl bg-card p-6 shadow-sovereign"
				>
					<div className="mb-6 text-center">
						<h2 className="text-headline text-foreground">
							Complete Official Admin Registration
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							Use your invite to finish registering your official LGU access.
						</p>
					</div>

					{isLoading || authLoading ? (
						<div className="flex items-center justify-center py-10">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : error ? (
						<div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
							<p className="font-medium">Invite unavailable</p>
							<p className="mt-1">
								{error.message ||
									"This invite is invalid, expired, or already used."}
							</p>
						</div>
					) : inviteComplete ? (
						<div className="flex flex-col items-center gap-4 py-10 text-center">
							<CheckCircle2 className="h-12 w-12 text-success" />
							<div>
								<p className="text-lg font-semibold text-foreground">
									Invite completed
								</p>
								<p className="mt-2 text-sm text-muted-foreground">
									Your official admin access is now active.
								</p>
							</div>
						</div>
					) : !invite ? (
						<div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
							Could not validate this invite.
						</div>
					) : (
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<div className="rounded-xl bg-surface-alt p-4">
								<p className="text-sm text-muted-foreground">
									Invited email
								</p>
								<p className="font-medium text-foreground">
									{invite.email}
								</p>
								<p className="mt-3 text-sm text-muted-foreground">
									Assigned role
								</p>
								<p className="font-medium text-foreground">
									{formatAccessLevelLabel(invite.role)}
								</p>
								<p className="mt-3 text-sm text-muted-foreground">
									Assigned scope
								</p>
								<p className="font-medium text-foreground">
									{invite.cityMunicipalityName
										? `${invite.cityMunicipalityName}, ${invite.provinceName}`
										: invite.provinceName}
								</p>
							</div>

							<input
								type="text"
								placeholder="Username"
								value={username}
								onChange={(event) => setUsername(event.target.value)}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
							<input
								type="text"
								placeholder="Full name"
								value={fullName}
								onChange={(event) => setFullName(event.target.value)}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
							<input
								type="password"
								placeholder="Password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
							<input
								type="password"
								placeholder="Confirm password"
								value={confirmPassword}
								onChange={(event) =>
									setConfirmPassword(event.target.value)
								}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>

							{user && user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
								<p className="text-sm text-destructive">
									You are currently signed in as {user.email}. This
									invite is only valid for {invite.email}.
								</p>
							) : null}

							<button
								type="submit"
								disabled={completingInvite}
								className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
							>
								{completingInvite ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : null}
								Complete Registration
							</button>

							<button
								type="button"
								onClick={() => void refetch()}
								className="text-sm font-medium text-accent hover:underline"
							>
								Refresh invite status
							</button>
						</form>
					)}
				</motion.div>
			</div>
		</div>
	);
}

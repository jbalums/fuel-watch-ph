import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
	ArrowLeft,
	Camera,
	Save,
	Loader2,
	LogOut,
	FileText,
	Lock,
	UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useManagedStation } from "@/hooks/useManagedStation";
import { useProfile } from "@/hooks/useProfile";
import { termsDisclaimerParagraphs } from "@/lib/legal";
import logo from "@/assets/images/Icon.png";
import logoFull from "@/assets/images/logo.png";

export default function Profile() {
	const { user, loading: authLoading, signOut } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { data: managedStation } = useManagedStation();
	const { data: profile, isLoading: profileLoading } = useProfile();

	const [displayName, setDisplayName] = useState("");
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [sendingPasswordReset, setSendingPasswordReset] = useState(false);

	const isEmailPasswordUser =
		user?.app_metadata?.provider === "email" ||
		(user?.identities?.some((identity) => identity.provider === "email") ??
			false);

	useEffect(() => {
		if (authLoading) return;
		if (!user) {
			navigate("/auth");
			return;
		}
	}, [user, authLoading, navigate]);

	useEffect(() => {
		if (!profile) return;
		setDisplayName(profile.displayName ?? "");
		setAvatarUrl(profile.avatarUrl);
	}, [profile]);

	const handleAvatarUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (!file || !user) return;

		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			toast.error("Image must be under 2MB");
			return;
		}

		setUploading(true);
		const ext = file.name.split(".").pop();
		const filePath = `${user.id}/avatar.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from("avatars")
			.upload(filePath, file, { upsert: true });

		if (uploadError) {
			toast.error("Upload failed: " + uploadError.message);
			setUploading(false);
			return;
		}

		const { data: publicUrl } = supabase.storage
			.from("avatars")
			.getPublicUrl(filePath);

		const url = publicUrl.publicUrl + "?t=" + Date.now();

		const { error: updateError } = await supabase
			.from("profiles")
			.update({ avatar_url: url })
			.eq("user_id", user.id);

		if (updateError) {
			toast.error("Failed to save avatar");
		} else {
			setAvatarUrl(url);
			await queryClient.invalidateQueries({
				queryKey: ["profile", user.id],
			});
			toast.success("Avatar updated!");
		}
		setUploading(false);
	};

	const handleSave = async () => {
		if (!user) return;
		setSaving(true);

		const { error } = await supabase
			.from("profiles")
			.update({ display_name: displayName })
			.eq("user_id", user.id);

		if (error) {
			toast.error("Failed to save: " + error.message);
		} else {
			await queryClient.invalidateQueries({
				queryKey: ["profile", user.id],
			});
			toast.success("Profile updated!");
		}
		setSaving(false);
	};

	const handleSendPasswordResetEmail = async () => {
		if (!user?.email) {
			toast.error("No email address found for this account");
			return;
		}

		setSendingPasswordReset(true);
		const { error } = await supabase.auth.resetPasswordForEmail(
			user.email,
			{
				redirectTo: `${window.location.origin}/auth?mode=reset`,
			},
		);

		if (error) {
			toast.error("Failed to send reset email: " + error.message);
		} else {
			toast.success("Check your email for the password reset link");
		}

		setSendingPasswordReset(false);
	};

	const initials = displayName
		? displayName
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
		: "?";

	if (authLoading || (user ? profileLoading : false)) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background pb-10">
			<header className="sticky top-0 z-40 surface-glass py-4">
				<div className="container flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft className="h-5 w-5" />
					</button>
					<h1 className="mr-auto text-base font-bold tracking-tight text-foreground">
						Profile
					</h1>
					<ThemeToggle />
					<div
						className="ml-4 flex cursor-pointer items-center rounded-lg"
						onClick={() => {
							navigate("/");
						}}
					>
						<img src={logo} className="h-10 w-10" />
						<h1 className="text-base font-bold tracking-tight text-foreground">
							<span className="text-primary">FuelWatch</span>{" "}
							<span className="text-amber-600">PH</span>
						</h1>
					</div>
				</div>
			</header>

			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ease: [0.2, 0.8, 0.2, 1] }}
				className="container mt-6"
			>
				<div className="relative mx-auto max-w-3xl rounded-2xl bg-card p-6 shadow-sovereign">
					<div className="absolute right-4 top-2">
						<img src={logoFull} className="h-20 opacity-40" />
					</div>

					<div className="flex flex-col items-start gap-3">
						<div className="flex items-center gap-4 max-w-[calc(100%-80px)]">
							<div className="mt-0.5 flex h-10 w-10 min-w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
								<UserRound className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-semibold text-foreground">
									Account Profile
								</h2>
								<p className="text-sm text-muted-foreground">
									Manage your personal details, password
									access, and account tools in one place.
								</p>
							</div>
						</div>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							Update how your name appears in the app, change your
							profile photo, and access account-related actions
							below.
						</p>
					</div>

					<div className="mt-6 space-y-8">
						<section>
							<h3 className="text-lg font-semibold text-primary dark:text-blue-500">
								Profile Details
							</h3>
							<div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-5">
								<div className="flex flex-col gap-5 md:flex-row md:items-center">
									<div className="relative w-fit">
										<Avatar className="h-24 w-24 ring-2 ring-border ring-offset-2 ring-offset-background">
											<AvatarImage
												src={avatarUrl ?? undefined}
												alt={displayName}
											/>
											<AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">
												{initials}
											</AvatarFallback>
										</Avatar>
										<button
											onClick={() =>
												fileInputRef.current?.click()
											}
											disabled={uploading}
											className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform hover:scale-105 disabled:opacity-50"
										>
											{uploading ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Camera className="h-4 w-4" />
											)}
										</button>
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											className="hidden"
											onChange={handleAvatarUpload}
										/>
									</div>

									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium text-foreground">
											Profile photo
										</p>
										<p className="mt-1 text-sm text-muted-foreground">
											Upload a clear image to personalize
											your account. Images must be under
											2MB.
										</p>
										<p className="mt-3 break-all text-sm text-muted-foreground">
											{user?.email}
										</p>
									</div>
								</div>

								<div className="mt-6 flex flex-col gap-1.5">
									<label className="text-xs font-medium text-muted-foreground">
										Display Name
									</label>
									<input
										type="text"
										value={displayName}
										onChange={(e) =>
											setDisplayName(e.target.value)
										}
										placeholder="Your display name"
										maxLength={30}
										className="w-full rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20"
									/>
									<p className="text-xs text-muted-foreground">
										Keep it short, like Jose R. This is how
										your name appears in the app header.
									</p>
								</div>

								<motion.button
									whileTap={{ scale: 0.97 }}
									onClick={handleSave}
									disabled={saving}
									className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
								>
									{saving ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Save className="h-4 w-4" />
									)}
									{saving ? "Saving..." : "Save Changes"}
								</motion.button>
							</div>
						</section>

						{managedStation && (
							<section>
								<h3 className="text-lg font-semibold text-primary dark:text-blue-500">
									Station Tools
								</h3>
								<div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-5">
									<p className="text-sm leading-6 text-muted-foreground">
										You are assigned as the manager for{" "}
										<span className="font-medium text-foreground">
											{managedStation.name}
										</span>
										. Open the manager dashboard to update
										station information and pricing tools.
									</p>
									<button
										onClick={() => navigate("/manager")}
										className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
									>
										Manage {managedStation.name}
									</button>
								</div>
							</section>
						)}

						{isEmailPasswordUser && (
							<section>
								<h3 className="text-lg font-semibold text-primary dark:text-blue-500">
									Security
								</h3>
								<div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-5">
									<div className="flex items-start gap-3">
										<div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
											<Lock className="h-4 w-4" />
										</div>
										<div className="flex-1">
											<h2 className="text-sm font-semibold text-foreground">
												Password
											</h2>
											<p className="mt-2 text-sm leading-6 text-muted-foreground">
												Signed in with email and
												password. Send a reset link to
												your email to change your
												password securely.
											</p>
											<motion.button
												whileTap={{ scale: 0.97 }}
												onClick={
													handleSendPasswordResetEmail
												}
												disabled={sendingPasswordReset}
												className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
											>
												{sendingPasswordReset ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Lock className="h-4 w-4" />
												)}
												{sendingPasswordReset
													? "Sending reset link..."
													: "Send Password Reset Email"}
											</motion.button>
										</div>
									</div>
								</div>
							</section>
						)}

						<section>
							<h3 className="text-lg font-semibold text-primary dark:text-blue-500">
								Fuel Information Disclaimer
							</h3>
							<div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-5">
								<div className="flex items-start gap-3">
									<div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
										<FileText className="h-4 w-4" />
									</div>
									<div className="flex-1">
										<p className="text-sm leading-6 text-muted-foreground">
											Please review the terms below before
											relying on fuel price and
											availability data shown in the app.
										</p>
										<div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
											{termsDisclaimerParagraphs.map(
												(paragraph) => (
													<p key={paragraph}>
														{paragraph}
													</p>
												),
											)}
										</div>
									</div>
								</div>
							</div>
						</section>

						<section>
							<h3 className="text-lg font-semibold text-primary dark:text-blue-500">
								Account Actions
							</h3>
							<div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-5">
								<p className="text-sm leading-6 text-muted-foreground">
									Sign out of FuelWatch PH on this device when
									you’re done managing your account.
								</p>
								<button
									onClick={async () => {
										await signOut();
										navigate("/");
									}}
									className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-destructive border border-destructive/30 py-3.5 font-semibold text-white transition-colors hover:bg-destructive/10"
								>
									<LogOut className="h-4 w-4" />
									Log Out
								</button>
							</div>
						</section>
					</div>
				</div>
			</motion.div>
		</div>
	);
}

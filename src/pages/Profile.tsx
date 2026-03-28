import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useManagedStation } from "@/hooks/useManagedStation";
import { termsDisclaimerParagraphs } from "@/lib/legal";

export default function Profile() {
	const { user, loading: authLoading, signOut } = useAuth();
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { data: managedStation } = useManagedStation();

	const [displayName, setDisplayName] = useState("");
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);

	useEffect(() => {
		if (authLoading) return;
		if (!user) {
			navigate("/auth");
			return;
		}

		const fetchProfile = async () => {
			const { data } = await supabase
				.from("profiles")
				.select("display_name, avatar_url")
				.eq("user_id", user.id)
				.single();

			if (data) {
				setDisplayName(data.display_name ?? "");
				setAvatarUrl(data.avatar_url);
			}
			setLoading(false);
		};

		fetchProfile();
	}, [user, authLoading, navigate]);

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
			toast.success("Profile updated!");
		}
		setSaving(false);
	};

	const initials = displayName
		? displayName
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
		: "?";

	if (authLoading || loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background px-5 pb-10">
			{/* Header */}
			<header className="sticky top-0 z-40 surface-glass py-4">
				<div className="container flex items-center gap-3">
					<button
						onClick={() => navigate("/")}
						className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground hover:text-foreground sovereign-ease transition-colors"
					>
						<ArrowLeft className="h-5 w-5" />
					</button>
					<h1 className="text-base font-bold text-foreground tracking-tight">
						Profile
					</h1>
				</div>
			</header>

			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ease: [0.2, 0.8, 0.2, 1] }}
				className="container mt-6 flex flex-col items-center gap-6"
			>
				{/* Avatar */}
				<div className="relative">
					<Avatar className="h-24 w-24 ring-2 ring-border ring-offset-2 ring-offset-background">
						<AvatarImage
							src={avatarUrl ?? undefined}
							alt={displayName}
						/>
						<AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
							{initials}
						</AvatarFallback>
					</Avatar>
					<button
						onClick={() => fileInputRef.current?.click()}
						disabled={uploading}
						className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md sovereign-ease hover:scale-105 transition-transform disabled:opacity-50"
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

				<p className="text-sm text-muted-foreground">{user?.email}</p>

				{/* Form */}
				<div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-sovereign">
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">
							Display Name
						</label>
						<input
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Your display name"
							className="w-full rounded-xl bg-surface-alt py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
						/>
					</div>

					<motion.button
						whileTap={{ scale: 0.97 }}
						onClick={handleSave}
						disabled={saving}
						className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground sovereign-ease hover:bg-primary-hover transition-colors disabled:opacity-50"
					>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						{saving ? "Saving..." : "Save Changes"}
					</motion.button>
				</div>

				{managedStation && (
					<button
						onClick={() => navigate("/manager")}
						className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
					>
						Manage {managedStation.name}
					</button>
				)}

				<div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-sovereign">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
							<FileText className="h-4 w-4" />
						</div>
						<div className="flex-1">
							<h2 className="text-sm font-semibold text-foreground">
								Terms | Fuel Information Disclaimer
							</h2>
							<div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
								{termsDisclaimerParagraphs.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</div>
						</div>
					</div>
				</div>

				<button
					onClick={async () => {
						await signOut();
						navigate("/");
					}}
					className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3.5 font-semibold text-destructive sovereign-ease hover:bg-destructive/10 transition-colors"
				>
					<LogOut className="h-4 w-4" />
					Log Out
				</button>
			</motion.div>
		</div>
	);
}

import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { privacyPolicySections } from "@/lib/legal";
import logo from "@/assets/images/Icon.png";
import logoFull from "@/assets/images/logo.png";
export default function PrivacyPolicy() {
	const navigate = useNavigate();

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
					<h1 className="text-base font-bold tracking-tight text-foreground">
						Privacy Policy
					</h1>

					<div
						className="cursor-pointer ml-auto rounded-lg flex items-center"
						onClick={() => {
							navigate("/");
						}}
					>
						<img src={logo} className="h-10 w-10" />
						<h1 className="text-base font-bold text-foreground tracking-tight">
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
				<div className="mx-auto max-w-3xl rounded-2xl bg-card p-6 shadow-sovereign relative">
					<div className="absolute right-4 top-2">
						<img src={logoFull} className="h-20 opacity-40" />
					</div>
					<div className="flex items-start gap-3 flex-col">
						<div className="flex items-center gap-4 max-w-[calc(100%-80px)]">
							<div className="mt-0.5 flex h-10 w-10 min-w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
								<ShieldCheck className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-semibold text-foreground">
									Your Privacy
								</h2>
							</div>
						</div>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							This page explains how FuelWatch PH handles account
							information, reports, and location-aware features
							used throughout the app.
						</p>
					</div>

					<div className="mt-6 space-y-6">
						{privacyPolicySections.map((section) => (
							<section key={section.title}>
								<h3 className="text-sm font-semibold text-foreground">
									{section.title}
								</h3>
								<div className="mt-2 space-y-3 text-sm leading-6 text-muted-foreground">
									{section.paragraphs.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
								</div>
							</section>
						))}
					</div>
				</div>
			</motion.div>
		</div>
	);
}

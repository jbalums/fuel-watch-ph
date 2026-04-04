import { motion } from "framer-motion";
import { ArrowLeft, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { aboutUsSections } from "@/lib/legal";
import logo from "@/assets/images/fuelwatch-icon.png";
import logoFull from "@/assets/images/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AboutUs() {
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
					<h1 className="text-base font-bold tracking-tight text-foreground mr-auto">
						About Us
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
								<Rocket className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-semibold text-foreground">
									FuelWatch PH
								</h2>
								<p className="text-sm text-muted-foreground">
									Community-powered fuel price transparency
									for drivers across the Philippines.
								</p>
							</div>
						</div>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							Learn why FuelWatch PH exists, what we aim to solve,
							and how community reports help more drivers make
							smarter fueling decisions.
						</p>
					</div>

					<div className="mt-6 space-y-8">
						{aboutUsSections.map((section) => (
							<section key={section.title}>
								<h3 className="text-lg font-semibold text-primary dark:text-blue-500">
									{section.title}
								</h3>
								<div className="mt-2 space-y-4 text-sm leading-6 text-muted-foreground">
									{section.paragraphs.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
									{section.bullets && (
										<ul className="space-y-0 pl-1">
											{section.bullets.map((bullet) => (
												<li key={bullet}>{bullet}</li>
											))}
										</ul>
									)}
								</div>
							</section>
						))}
					</div>
				</div>
			</motion.div>
		</div>
	);
}

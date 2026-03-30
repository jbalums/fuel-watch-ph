import { motion } from "framer-motion";
import { ArrowLeft, Globe, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
	contactUsChannels,
	contactUsIntro,
	contactUsSections,
} from "@/lib/legal";
import logo from "@/assets/images/Icon.png";
import logoFull from "@/assets/images/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

function getChannelIcon(title: string) {
	if (title === "Email") {
		return Mail;
	}

	return Globe;
}

export default function ContactUs() {
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
					<h1 className="mr-auto text-base font-bold tracking-tight text-foreground">
						Contact Us
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
								<Mail className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-semibold text-foreground">
									Get in Touch
								</h2>
								<p className="text-sm text-muted-foreground">
									We’d love to hear from the FuelWatch PH
									community.
								</p>
							</div>
						</div>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							{contactUsIntro}
						</p>
					</div>

					<div className="mt-6 grid gap-4 md:grid-cols-2">
						{contactUsChannels.map((channel) => {
							const Icon = getChannelIcon(channel.title);

							return (
								<a
									key={channel.title}
									href={channel.href}
									target={
										channel.href.startsWith("http")
											? "_blank"
											: undefined
									}
									rel={
										channel.href.startsWith("http")
											? "noreferrer"
											: undefined
									}
									className="rounded-2xl border border-border bg-secondary/40 p-4 transition-colors hover:border-accent/30 hover:bg-secondary/60"
								>
									<div className="flex items-start gap-3">
										<div className="mt-0.5 flex h-10 w-10 min-w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
											<Icon className="h-5 w-5" />
										</div>
										<div className="min-w-0">
											<h3 className="font-semibold text-foreground">
												{channel.title}
											</h3>
											<p className="mt-1 text-sm leading-6 text-muted-foreground">
												{channel.description}
											</p>
											<p className="mt-3 break-all text-sm font-medium text-accent">
												{channel.label}
											</p>
										</div>
									</div>
								</a>
							);
						})}
					</div>

					<div className="mt-8 space-y-8">
						{contactUsSections.map((section) => (
							<section key={section.title}>
								<h3 className="text-lg font-semibold text-primary dark:text-blue-500">
									{section.title}
								</h3>
								<div className="mt-2 space-y-4 text-sm leading-6 text-muted-foreground">
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

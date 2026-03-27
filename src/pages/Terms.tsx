import { motion } from "framer-motion";
import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { termsDisclaimerParagraphs } from "@/lib/legal";

export default function Terms() {
	const navigate = useNavigate();

	return (
		<div className="min-h-screen bg-background px-5 pb-10">
			<header className="sticky top-0 z-40 surface-glass py-4">
				<div className="container flex items-center gap-3">
					<button
						onClick={() => navigate(-1)}
						className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft className="h-5 w-5" />
					</button>
					<h1 className="text-base font-bold tracking-tight text-foreground">
						Terms
					</h1>
				</div>
			</header>

			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ease: [0.2, 0.8, 0.2, 1] }}
				className="container mt-6"
			>
				<div className="mx-auto max-w-3xl rounded-2xl bg-card p-6 shadow-sovereign">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
							<FileText className="h-5 w-5" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								Fuel Information Disclaimer
							</h2>
							<p className="mt-1 text-sm leading-6 text-muted-foreground">
								Please review these terms before relying on any
								fuel price, stock, or station availability data
								shown in the app.
							</p>
						</div>
					</div>

					<div className="mt-6 space-y-3 text-sm leading-6 text-muted-foreground">
						{termsDisclaimerParagraphs.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
					</div>
				</div>
			</motion.div>
		</div>
	);
}

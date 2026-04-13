import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle({ showLabel: boolean = false }) {
	const { theme, toggleTheme } = useTheme();

	return (
		<button
			onClick={toggleTheme}
			className="relative flex h-8 w-8 items-center justify-center rounded-2xl bg-secondary text-foreground sovereign-ease hover:bg-muted transition-colors"
			aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
		>
			<AnimatePresence mode="wait" initial={false}>
				{theme === "light" ? (
					<motion.div
						key="sun"
						initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
						animate={{ opacity: 1, scale: 1, rotate: 0 }}
						exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
						transition={{ duration: 0.2 }}
					>
						<Sun className="h-4 w-4" />
					</motion.div>
				) : (
					<motion.div
						key="moon"
						initial={{ opacity: 0, scale: 0.6, rotate: 90 }}
						animate={{ opacity: 1, scale: 1, rotate: 0 }}
						exit={{ opacity: 0, scale: 0.6, rotate: -90 }}
						transition={{ duration: 0.2 }}
					>
						<Moon className="h-4 w-4" />
					</motion.div>
				)}
			</AnimatePresence>
		</button>
	);
}

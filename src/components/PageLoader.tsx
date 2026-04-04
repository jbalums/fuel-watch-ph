import Lottie from "lottie-react";
import fuelwatchLoaderAnimation from "@/assets/lottie/json/fuelwatch-ph-lottie-no-bg.json";

interface PageLoaderProps {
	visible: boolean;
}

export function PageLoader({ visible }: PageLoaderProps) {
	if (!visible) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[120] flex items-center justify-center bg-white/82 backdrop-blur-sm">
			<div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-border/40">
				<div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-primary via-amber-500 to-primary" />
			</div>
			<div className="mx-4 flex min-w-[280px] items-center gap-4 rounded-2xl border border-border bg-card/50 dark:bg-background/75 px-5 py-4 shadow-sovereign flex-col">
				<div className="flex h-16 shrink-0 items-center justify-center overflow-hidden ">
					<Lottie
						animationData={fuelwatchLoaderAnimation}
						loop
						autoplay
						className="h-16"
						aria-label="FuelWatch PH loader animation"
					/>
				</div>
				<div className="min-w-0 text-center">
					{/* <p className="text-sm font-semibold text-foreground">
						Loading page
					</p> */}
					<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
						<span>Preparing the next view...</span>
					</div>
				</div>
			</div>
		</div>
	);
}

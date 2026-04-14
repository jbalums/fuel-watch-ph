import { Settings2 } from "lucide-react";
import logo from "@/assets/images/fuelwatch-ph-icon.png";

export default function MaintenancePage() {
	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12 text-white">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.18),_transparent_34%)]" />
			<div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:36px_36px]" />

			<div className="relative w-full max-w-2xl rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl md:p-10">
				<div className="flex flex-col items-center text-center">
					<div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
						<img
							src={logo}
							alt="FuelWatch PH"
							className="h-10 w-10 object-contain"
						/>
					</div>
					<div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
						<Settings2 className="h-3.5 w-3.5" />
						Maintenance Mode
					</div>
					<h1 className="mt-6 text-3xl font-bold tracking-tight md:text-5xl">
						FuelWatch PH is getting a quick tune-up.
					</h1>
					<p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 md:text-base">
						We’re doing a short maintenance pass to keep station
						data, maps, and reporting tools running smoothly. Please
						check back in a little while.
					</p>
					<div className="mt-8 grid w-full gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-left text-sm text-slate-200 md:grid-cols-2">
						<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
							<p className="font-semibold text-white">
								What’s happening
							</p>
							<p className="mt-2 leading-6">
								We’re updating platform services and checking
								key features before reopening access.
							</p>
						</div>
						<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
							<p className="font-semibold text-white">
								What you can expect
							</p>
							<p className="mt-2 leading-6">
								Once maintenance is complete, FuelWatch PH will
								return automatically without any action needed
								from you.
							</p>
						</div>
					</div>
					<p className="mt-8 text-xs uppercase tracking-[0.24em] text-slate-300">
						Thank you for your patience
					</p>
				</div>
			</div>
		</div>
	);
}

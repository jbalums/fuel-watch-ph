import { useMemo } from "react";
import { GasStation } from "@/types/station";
import { StatusBadge } from "./StatusBadge";
import { motion } from "framer-motion";
import { MapPin, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { calculateDistanceKm } from "@/utils/distance";
import { LguVerifiedBadge } from "./LguVerifiedBadge";
import { VerifiedStationBadge } from "./VerifiedStationBadge";

interface StationCardProps {
	station: GasStation;
	index: number;
	userLocation: {
		lat: number;
		lng: number;
	} | null;
}

export function StationCard({ station, index, userLocation }: StationCardProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const statusBarColor =
		station.status === "Available"
			? "status-bar-available"
			: station.status === "Low"
				? "status-bar-low"
				: "status-bar-out";
	const distanceLabel = useMemo(() => {
		if (!userLocation) {
			return "Distance unavailable";
		}

		const distanceKm = calculateDistanceKm(
			userLocation.lat,
			userLocation.lng,
			station.lat,
			station.lng,
		);

		if (!Number.isFinite(distanceKm)) {
			return "Distance unavailable";
		}

		return `${distanceKm.toFixed(1)} km away`;
	}, [station.lat, station.lng, userLocation]);

	const handleOpenOnMap = () => {
		const searchParams = new URLSearchParams(location.search);
		searchParams.set("station", station.id);

		navigate({
			pathname: "/map",
			search: searchParams.toString(),
		});
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			transition={{
				duration: 0.4,
				delay: index * 0.05,
				ease: [0.2, 0.8, 0.2, 1],
			}}
			whileTap={{ scale: 0.97 }}
			onClick={handleOpenOnMap}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					handleOpenOnMap();
				}
			}}
			role="button"
			tabIndex={0}
			className="group relative flex overflow-hidden rounded-xl bg-card shadow-sovereign cursor-pointer sovereign-ease"
		>
			{/* Status bar */}
			<div className={cn("w-1 shrink-0 rounded-l-xl", statusBarColor)} />

			<div className="flex flex-1 flex-col gap-3 p-5">
				<div className="flex items-start justify-between gap-3 flex-wrap">
					<div className="flex flex-col w-full">
						<div className="flex w-full justify-between flex-wrap">
							<h3 className=" font-semibold text-foreground max-w-[calc(100%-90px)]">
								{station.name}
							</h3>
							<StatusBadge
								className="h-6"
								status={station.status}
							/>
						</div>
						<div className="mt-1 flex items-start gap-1.5 text-muted-foreground">
							<MapPin className="h-3.5 w-3.5 mt-[3px] shrink-0" />
							<span className=" text-sm pr-4">
								{station.address}
							</span>
						</div>
						{(station.isLguVerified || station.isVerified) && (
							<div className="mt-3 flex flex-wrap items-center gap-2">
								{station.isLguVerified && <LguVerifiedBadge />}
								{station.isVerified && <VerifiedStationBadge />}
							</div>
						)}
					</div>
				</div>

				<div className="flex flex-wrap items-end justify-between">
					<div className="flex flex-wrap gap-2 md:gap-4 items-center pb-4">
						<div className="">
							<span className="text-label !text-green-600">
								Unleaded
							</span>
							<p className="mt-0.5 text-xl md:text-2xl font-bold tabular-nums text-shadow-sm text-shadow-blue-300">
								{station.status === "Out"
									? "—"
									: `₱${station.prices?.Unleaded > 0 ? Number(station.prices?.Unleaded).toFixed(2) : "-"}`}
							</p>
						</div>
						<div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-600"></div>
						<div>
							<span className="text-label !text-red-600">
								Premium
							</span>
							<p className="mt-0.5 text-xl md:text-2xl font-bold tabular-nums text-foreground">
								{station.status === "Out"
									? "—"
									: `₱${station.prices?.Premium > 0 ? Number(station.prices?.Premium).toFixed(2) : "-"}`}
							</p>
						</div>
						<div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-600"></div>
						<div>
							<span className="text-label !text-amber-600">
								Diesel
							</span>
							<p className="mt-0.5 text-xl md:text-2xl font-bold tabular-nums text-foreground">
								{station.status === "Out"
									? "—"
									: `₱${station.prices?.Diesel > 0 ? Number(station.prices?.Diesel).toFixed(2) : "-"}`}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						<span className="flex items-center gap-1">
							<MapPin className="h-3 w-3" />
							{distanceLabel}
						</span>
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{station.lastUpdated}
						</span>
						<span className="flex items-center gap-1">
							<Users className="h-3 w-3" />
							{station.reportCount}
						</span>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

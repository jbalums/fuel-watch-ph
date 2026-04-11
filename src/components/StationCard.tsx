import { type MouseEvent, useMemo } from "react";
import { FilterFuelType, GasStation, StationStatus } from "@/types/station";
import { StatusBadge } from "./StatusBadge";
import { motion } from "framer-motion";
import { Clock, MapPin, Navigation, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { fuelTypes, fuelTypeTextColorClassNames } from "@/lib/fuel-prices";
import { Button } from "@/components/ui/button";
import { useStationBrandLogos } from "@/hooks/useStationBrandLogos";
import {
	buildGoogleMapsDirectionsUrl,
	openGoogleMapsDirections,
} from "@/lib/google-maps-directions";
import { resolveStationBrandLogo } from "@/lib/station-brand-logos";
import { calculateDistanceKm } from "@/utils/distance";
import { LguVerifiedBadge } from "./LguVerifiedBadge";
import { PriceTrendIndicator } from "./PriceTrendIndicator";
import { VerifiedStationBadge } from "./VerifiedStationBadge";
import { isFuelSellable } from "@/lib/fuel-prices";

interface StationCardProps {
	station: GasStation;
	index: number;
	userLocation: {
		lat: number;
		lng: number;
	} | null;
	openOnMapInNewTab?: boolean;
	hideDistanceLabel?: boolean;
	activeFuelFilter?: FilterFuelType;
}

export function StationCard({
	station,
	index,
	userLocation,
	openOnMapInNewTab = false,
	hideDistanceLabel = false,
	activeFuelFilter = "All",
}: StationCardProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const { data: stationBrandLogos = [] } = useStationBrandLogos();
	const selectedFuelStatus =
		activeFuelFilter === "All"
			? null
			: (station.fuelAvailability[activeFuelFilter] ?? station.status);
	const displayStatus = (selectedFuelStatus ??
		station.status) as StationStatus;
	const statusBarColor =
		displayStatus === "Available"
			? "status-bar-available"
			: displayStatus === "Low"
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
	const directionsUrl = useMemo(
		() =>
			buildGoogleMapsDirectionsUrl({
				lat: station.lat,
				lng: station.lng,
				placeId: station.googlePlaceId,
			}),
		[station.googlePlaceId, station.lat, station.lng],
	);
	const matchedBrandLogo = useMemo(
		() =>
			resolveStationBrandLogo(
				{
					name: station.name,
					stationBrandLogoId: station.stationBrandLogoId,
				},
				stationBrandLogos,
			),
		[station.name, station.stationBrandLogoId, stationBrandLogos],
	);

	const handleOpenOnMap = () => {
		const searchParams = new URLSearchParams(location.search);
		searchParams.set("station", station.id);

		if (openOnMapInNewTab) {
			window.open(
				`/map?${searchParams.toString()}`,
				"_blank",
				"noopener,noreferrer",
			);
			return;
		}

		navigate({
			pathname: "/map",
			search: searchParams.toString(),
		});
	};
	const handleGetDirections = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		openGoogleMapsDirections({
			lat: station.lat,
			lng: station.lng,
			placeId: station.googlePlaceId,
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
			className="group relative flex overflow-hidden rounded-lg bg-card shadow-sovereign cursor-pointer sovereign-ease border-[0.5px] border-primary"
		>
			{/* Status bar */}
			{/* <div className={cn("w-1 shrink-0 rounded-lg", statusBarColor)} /> */}

			<div className="flex flex-1 flex-col gap-3 p-5">
				<div className="flex items-start justify-between gap-3 flex-wrap">
					<div className="flex flex-col w-full">
						<div className="flex w-full justify-between flex-wrap">
							<div className="flex max-w-[calc(100%-90px)] items-center gap-2">
								{matchedBrandLogo?.logoUrl ? (
									<img
										src={matchedBrandLogo.logoUrl}
										alt={`${matchedBrandLogo.brandName} logo`}
										className="h-24 w-24 absolute right-1 top-12 opacity-20"
										loading="lazy"
									/>
								) : null}
								<h3 className="font-semibold text-foreground line-clamp-1">
									{station.name}
								</h3>
							</div>
						</div>
						<div className="mt-1 flex items-start gap-1.5 text-muted-foreground">
							<MapPin className="h-3.5 w-3.5 mt-[3px] shrink-0" />
							<span className=" text-sm pr-4 line-clamp-1">
								{station.address}
							</span>
						</div>
						{(station.isLguVerified || station.isVerified) && (
							<div className="absolute top-2 right-2 mt-3 flex flex-wrap items-center gap-2">
								{station.isLguVerified && <LguVerifiedBadge />}
								{station.isVerified && <VerifiedStationBadge />}
							</div>
						)}
					</div>
				</div>

				<div className="flex flex-col">
					<div className="grid grid-cols-3 xl:grid-cols-5 gap-x-3 gap-y-3">
						{fuelTypes.map((fuelType) => {
							const price = station.prices?.[fuelType];
							const hasPrice =
								typeof price === "number" &&
								Number.isFinite(price) &&
								price > 0;
							const availability =
								station.fuelAvailability[fuelType] ??
								(hasPrice ? station.status : null);
							const shouldShowRow = true;
							//								availability !== null || hasPrice;

							return (
								<div
									key={`${station.id}-${fuelType}`}
									className={`min-w-0 ${shouldShowRow ? "" : "hidden"}`}
								>
									<span
										className={cn(
											"text-label flex items-center relative font-semibold",
											fuelTypeTextColorClassNames[
												fuelType
											],
										)}
									>
										{fuelType == "Premium Diesel" ? (
											<span>
												<span className="absolute -top-[10px] text-[10px]">
													Premium
												</span>
												<span>Diesel</span>
											</span>
										) : (
											fuelType
										)}
										{/* {availability ? (
											<StatusBadge
												status={availability}
												compact
												className="ml-1 px-1 !rounded-sm !py-1 text-[8px]"
											/>
										) : null} */}
									</span>
									<p className="mt-0 text-base font-bold tabular-nums text-foreground md:text-lg">
										{availability === "Out" ? (
											<span className="opacity-10">
												—
											</span>
										) : hasPrice ? (
											`₱ ${price.toFixed(2)}`
										) : (
											<span className="opacity-10">
												—
											</span>
										)}
									</p>

									<div className="h-4 flex items-center justify-start">
										<PriceTrendIndicator
											delta={
												!isFuelSellable(availability) ||
												!hasPrice
													? null
													: station.priceTrends[
															fuelType
														]
											}
										/>
									</div>
								</div>
							);
						})}
					</div>
					<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
						<Button
							type="button"
							variant="outlineprimary"
							size="xs"
							className="py-0 px-2 !text-[11px] sm:text-sm"
							onClick={handleGetDirections}
							onKeyDown={(event) => {
								if (
									event.key === "Enter" ||
									event.key === " "
								) {
									event.stopPropagation();
								}
							}}
							disabled={!directionsUrl}
						>
							<Navigation className="h-2 w-2" />
							Get Directions
						</Button>
						{!hideDistanceLabel ? (
							<span className="flex items-center gap-1">
								<MapPin className="h-3 w-3" />
								{distanceLabel}
							</span>
						) : null}
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

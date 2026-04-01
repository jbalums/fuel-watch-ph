import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
	ChevronDown,
	ChevronUp,
	Expand,
	Minimize2,
	SlidersHorizontal,
} from "lucide-react";
import { SearchFilter } from "@/components/SearchFilter";
import { StationResultsList } from "@/components/StationResultsList";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { usePublicStationResults } from "@/hooks/usePublicStationResults";
import { toast } from "@/lib/app-toast";
import { fuelTypes as availableFuelTypes } from "@/lib/fuel-prices";
import { cn } from "@/lib/utils";
import type { FilterFuelType, SortOption, StatusFilter } from "@/types/station";
import logo from "@/assets/images/Icon.png";

const EMBED_STATIONS_PER_PAGE = 10;
const fuelFilters: FilterFuelType[] = ["All", ...availableFuelTypes];
const statusFilters: StatusFilter[] = ["All", "Available", "Low", "Out"];
const sortOptions: SortOption[] = ["price_asc", "price_desc"];

function parsePageParam(rawValue: string | null) {
	if (!rawValue) {
		return 1;
	}

	const parsedPage = Number.parseInt(rawValue, 10);
	return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function isFuelFilter(value: string | null): value is FilterFuelType {
	return value !== null && fuelFilters.includes(value as FilterFuelType);
}

function isStatusFilter(value: string | null): value is StatusFilter {
	return value !== null && statusFilters.includes(value as StatusFilter);
}

function isSortOption(value: string | null): value is SortOption {
	return value !== null && sortOptions.includes(value as SortOption);
}

export default function EmbeddedStationsPage() {
	const embedRootRef = useRef<HTMLDivElement>(null);
	const [searchParams, setSearchParams] = useSearchParams();
	const { provinces, citiesByProvince } = useGeoReferences();
	const searchQuery = searchParams.get("q") ?? "";
	const fuelFilter = isFuelFilter(searchParams.get("fuel"))
		? searchParams.get("fuel")!
		: "All";
	const statusFilter = isStatusFilter(searchParams.get("status"))
		? searchParams.get("status")!
		: "All";
	const sortBy = isSortOption(searchParams.get("sort"))
		? searchParams.get("sort")!
		: "price_asc";
	const provinceCode = searchParams.get("provinceCode") ?? "";
	const cityMunicipalityCode = searchParams.get("cityMunicipalityCode") ?? "";
	const currentPage = parsePageParam(searchParams.get("page"));
	const availableCities = useMemo(
		() => (provinceCode ? (citiesByProvince.get(provinceCode) ?? []) : []),
		[citiesByProvince, provinceCode],
	);
	const hasActiveFilters =
		!!searchQuery ||
		fuelFilter !== "All" ||
		statusFilter !== "All" ||
		sortBy !== "price_asc" ||
		!!provinceCode ||
		!!cityMunicipalityCode;
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const { stations, totalCount, isLoading } = usePublicStationResults({
		searchQuery,
		fuelFilter,
		statusFilter,
		sortBy,
		page: currentPage,
		pageSize: EMBED_STATIONS_PER_PAGE,
		provinceCode,
		cityMunicipalityCode,
		searchDebounceMs: 0,
	});
	const totalPages = Math.max(
		1,
		Math.ceil(totalCount / EMBED_STATIONS_PER_PAGE),
	);
	const fullscreenSupported =
		typeof document !== "undefined" &&
		typeof document.documentElement.requestFullscreen === "function";

	useEffect(() => {
		if (isLoading || currentPage <= totalPages) {
			return;
		}

		const nextSearchParams = new URLSearchParams(searchParams);
		if (totalPages <= 1) {
			nextSearchParams.delete("page");
		} else {
			nextSearchParams.set("page", String(totalPages));
		}
		setSearchParams(nextSearchParams, { replace: true });
	}, [currentPage, isLoading, searchParams, setSearchParams, totalPages]);

	useEffect(() => {
		if (typeof document === "undefined") {
			return;
		}

		const handleFullscreenChange = () => {
			setIsFullscreen(Boolean(document.fullscreenElement));
		};

		handleFullscreenChange();
		document.addEventListener("fullscreenchange", handleFullscreenChange);

		return () => {
			document.removeEventListener(
				"fullscreenchange",
				handleFullscreenChange,
			);
		};
	}, []);

	const updateSearchParams = (
		updates: Record<string, string | null>,
		resetPage = true,
	) => {
		const nextSearchParams = new URLSearchParams(searchParams);

		for (const [key, value] of Object.entries(updates)) {
			if (!value) {
				nextSearchParams.delete(key);
			} else {
				nextSearchParams.set(key, value);
			}
		}

		if (resetPage) {
			nextSearchParams.delete("page");
		}

		setSearchParams(nextSearchParams, { replace: true });
	};

	const handlePageChange = (page: number) => {
		const nextSearchParams = new URLSearchParams(searchParams);

		if (page <= 1) {
			nextSearchParams.delete("page");
		} else {
			nextSearchParams.set("page", String(page));
		}

		setSearchParams(nextSearchParams, { replace: true });
	};

	const toggleFullscreen = async () => {
		if (!fullscreenSupported) {
			toast.info("Fullscreen mode is not available in this browser");
			return;
		}

		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
				return;
			}

			await (
				embedRootRef.current ?? document.documentElement
			).requestFullscreen();
		} catch {
			toast.error("Could not toggle fullscreen mode");
		}
	};

	return (
		<div ref={embedRootRef} className="bg-background p-3 md:p-5 relative">
			<div className="mx-auto max-w-5xl">
				<div className="h-12 pt-1 w-full top-0 backdrop-blur-lg px-4 sticky flex z-[2000] ">
					<a
						href="https://fuelwatchph.com/"
						target="_blank"
						className="flex"
					>
						<div className="flex h-8 w-8 items-center justify-center">
							<img src={logo} className="h-8" />
						</div>
						<div>
							<h1 className="text-base font-bold tracking-tight text-foreground">
								<span className="text-primary">FuelWatch</span>{" "}
								<span className="text-amber-600">PH</span>
							</h1>
							<p className="text-[10px] text-muted-foreground">
								Know before you fill up
							</p>
						</div>
					</a>
					{fullscreenSupported ? (
						<button
							type="button"
							onClick={() => void toggleFullscreen()}
							className={cn(
								"inline-flex ml-auto h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium sovereign-ease transition-colors",
								isFullscreen
									? "border-accent/30 bg-accent/10 text-accent"
									: "border-border bg-surface-alt text-muted-foreground hover:text-foreground",
							)}
						>
							{isFullscreen ? (
								<Minimize2 className="h-4 w-4" />
							) : (
								<Expand className="h-4 w-4" />
							)}
							{isFullscreen ? "Exit fullscreen" : "Fullscreen"}
						</button>
					) : null}
				</div>
				<div className="mb-4 rounded-2xl border border-border bg-card/95 p-3 shadow-sovereign">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-sm font-semibold text-foreground">
								Find Stations
							</p>
							<p className="text-xs text-muted-foreground">
								Browse nearby stations and narrow the list with
								filters when needed.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() =>
									setFiltersOpen((current) => !current)
								}
								className={cn(
									"inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium sovereign-ease transition-colors",
									hasActiveFilters || filtersOpen
										? "border-accent/30 bg-accent/10 text-accent"
										: "border-border bg-surface-alt text-muted-foreground hover:text-foreground",
								)}
							>
								<SlidersHorizontal className="h-4 w-4" />
								Filters
								{hasActiveFilters ? (
									<span className="h-1.5 w-1.5 rounded-full bg-current" />
								) : null}
								{filtersOpen ? (
									<ChevronUp className="h-3.5 w-3.5" />
								) : (
									<ChevronDown className="h-3.5 w-3.5" />
								)}
							</button>
						</div>
					</div>

					{filtersOpen ? (
						<div className="mt-3 border-t border-border pt-3">
							<SearchFilter
								searchQuery={searchQuery}
								onSearchChange={(value) =>
									updateSearchParams({
										q: value.trim() ? value : null,
									})
								}
								fuelFilter={fuelFilter}
								onFuelFilterChange={(value) =>
									updateSearchParams({
										fuel: value === "All" ? null : value,
									})
								}
								statusFilter={statusFilter}
								onStatusFilterChange={(value) =>
									updateSearchParams({
										status: value === "All" ? null : value,
									})
								}
								sortBy={sortBy}
								onSortChange={(value) =>
									updateSearchParams({
										sort:
											value === "price_asc"
												? null
												: value,
									})
								}
								provinces={provinces}
								cities={availableCities}
								provinceCode={provinceCode}
								cityMunicipalityCode={cityMunicipalityCode}
								onProvinceChange={(nextProvinceCode) =>
									updateSearchParams({
										provinceCode: nextProvinceCode || null,
										cityMunicipalityCode: null,
									})
								}
								onCityChange={(nextCityMunicipalityCode) =>
									updateSearchParams({
										cityMunicipalityCode:
											nextCityMunicipalityCode || null,
									})
								}
							/>
						</div>
					) : null}
				</div>
				<StationResultsList
					stations={stations}
					loading={isLoading}
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={handlePageChange}
					openOnMapInNewTab
					hideDistanceLabel
					emptyMessage="No stations match the embedded location filters."
				/>
			</div>
			<div className="text-center">
				<span className="text-xs">
					Powered by:{" "}
					<a
						href="https://fuelwatchph.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-500 hover:underline"
					>
						FuelWatch PH
					</a>
				</span>
			</div>
		</div>
	);
}

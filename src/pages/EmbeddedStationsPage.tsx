import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { StationResultsList } from "@/components/StationResultsList";
import { usePublicStationResults } from "@/hooks/usePublicStationResults";
import logo from "@/assets/images/Icon.png";
const EMBED_STATIONS_PER_PAGE = 10;

function parsePageParam(rawValue: string | null) {
	if (!rawValue) {
		return 1;
	}

	const parsedPage = Number.parseInt(rawValue, 10);
	return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

export default function EmbeddedStationsPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const provinceCode = searchParams.get("provinceCode") ?? "";
	const cityMunicipalityCode = searchParams.get("cityMunicipalityCode") ?? "";
	const currentPage = parsePageParam(searchParams.get("page"));
	const { stations, totalCount, isLoading } = usePublicStationResults({
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

	const handlePageChange = (page: number) => {
		const nextSearchParams = new URLSearchParams(searchParams);

		if (page <= 1) {
			nextSearchParams.delete("page");
		} else {
			nextSearchParams.set("page", String(page));
		}

		setSearchParams(nextSearchParams, { replace: true });
	};

	return (
		<div className="min-h-screen bg-background p-3 md:p-5 relative">
			<div className="mx-auto max-w-5xl">
				<a
					href="https://fuelwatchph.com/"
					target="_blank"
					className="flex h-12 pt-1 w-full top-0 backdrop-blur-lg px-4 z-[2000] sticky"
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
				<StationResultsList
					stations={stations}
					loading={isLoading}
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={handlePageChange}
					openOnMapInNewTab
					emptyMessage="No stations match the embedded location filters."
				/>
			</div>
			<div className="text-center">
				<span className="text-xs">
					Powered by:{" "}
					<a
						href="https://fuelfinder.ph"
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-500 hover:underline"
					>
						FuelFinder PH
					</a>
				</span>
			</div>
		</div>
	);
}

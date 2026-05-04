import { useMemo, useState, type ReactNode } from "react";
import {
	ArrowUpDown,
	ChevronDown,
	ChevronUp,
	Search,
} from "lucide-react";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import {
	fuelTypes,
	normalizeFuelPrices,
	type FuelType,
} from "@/lib/fuel-prices";
import type { GasStationRow } from "@/components/admin/admin-shared";

type SortKey = "name" | FuelType;
type SortDirection = "asc" | "desc";

function isFuelType(value: string | null | undefined): value is FuelType {
	return Boolean(value && fuelTypes.includes(value as FuelType));
}

function getStationFuelPrice(station: GasStationRow, fuelType: FuelType) {
	const prices = normalizeFuelPrices(
		station.prices,
		isFuelType(station.fuel_type) ? station.fuel_type : undefined,
		typeof station.price_per_liter === "number"
			? station.price_per_liter
			: Number(station.price_per_liter) || 0,
	);
	const price = prices[fuelType];

	return typeof price === "number" && Number.isFinite(price) && price > 0
		? price
		: null;
}

function formatFuelPrice(price: number | null) {
	return price === null ? "--.--" : price.toFixed(2);
}

function compareTextValues(a: string, b: string, direction: SortDirection) {
	const result = a.localeCompare(b, undefined, { sensitivity: "base" });
	return direction === "asc" ? result : -result;
}

export function StationsSummaryView({
	title,
	description,
	stations,
	searchPlaceholder,
	headerFilters,
	asOfDateLabel,
}: {
	title: string;
	description: string;
	stations: GasStationRow[];
	searchPlaceholder: string;
	headerFilters?: ReactNode;
	asOfDateLabel?: string | null;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortKey, setSortKey] = useState<SortKey>("name");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

	const filteredStations = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		if (!normalizedQuery) {
			return stations;
		}

		return stations.filter((station) => {
			return (
				station.name.toLowerCase().includes(normalizedQuery) ||
				station.address.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [searchQuery, stations]);

	const averagePrices = useMemo(() => {
		return fuelTypes.reduce<Record<FuelType, number | null>>(
			(accumulator, fuelType) => {
				let total = 0;
				let count = 0;

				for (const station of filteredStations) {
					const price = getStationFuelPrice(station, fuelType);
					if (price === null) {
						continue;
					}

					total += price;
					count += 1;
				}

				accumulator[fuelType] =
					count > 0 ? Number((total / count).toFixed(2)) : null;
				return accumulator;
			},
			{} as Record<FuelType, number | null>,
		);
	}, [filteredStations]);

	const sortedStations = useMemo(() => {
		const nextStations = [...filteredStations];

		nextStations.sort((leftStation, rightStation) => {
			if (sortKey === "name") {
				return compareTextValues(
					leftStation.name,
					rightStation.name,
					sortDirection,
				);
			}

			const leftPrice = getStationFuelPrice(leftStation, sortKey);
			const rightPrice = getStationFuelPrice(rightStation, sortKey);

			if (leftPrice === null && rightPrice === null) {
				return compareTextValues(
					leftStation.name,
					rightStation.name,
					"asc",
				);
			}

			if (leftPrice === null) {
				return 1;
			}

			if (rightPrice === null) {
				return -1;
			}

			const difference = leftPrice - rightPrice;
			if (difference !== 0) {
				return sortDirection === "asc" ? difference : -difference;
			}

			return compareTextValues(leftStation.name, rightStation.name, "asc");
		});

		return nextStations;
	}, [filteredStations, sortDirection, sortKey]);

	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedStations,
		setCurrentPage,
	} = usePaginatedList(
		sortedStations,
		`${searchQuery}|${sortKey}|${sortDirection}`,
	);

	const toggleSort = (nextSortKey: SortKey) => {
		if (sortKey === nextSortKey) {
			setSortDirection((currentDirection) =>
				currentDirection === "asc" ? "desc" : "asc",
			);
			return;
		}

		setSortKey(nextSortKey);
		setSortDirection(nextSortKey === "name" ? "asc" : "desc");
	};

	const renderSortIcon = (columnKey: SortKey) => {
		if (sortKey !== columnKey) {
			return <ArrowUpDown className="h-3.5 w-3.5" />;
		}

		return sortDirection === "asc" ? (
			<ChevronUp className="h-3.5 w-3.5" />
		) : (
			<ChevronDown className="h-3.5 w-3.5" />
		);
	};

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-5 flex flex-col gap-3 border-b-2 pb-5">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						{title}
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						{description}
					</p>
				</div>
				<div className="rounded-2xl border border-border bg-secondary/20 p-4">
					<p className="text-sm font-medium text-foreground">
						{asOfDateLabel
							? `Average fuel prices as of ${asOfDateLabel} based on [${filteredStations.length}] stations`
							: `Average fuel prices based on [${filteredStations.length}] stations`}
					</p>
					<div className="mt-4 overflow-x-auto">
						<div className="grid min-w-[720px] grid-cols-5 gap-3">
							{fuelTypes.map((fuelType) => (
								<div key={`${fuelType}-label`}>
									<p className="text-xs font-semibold text-muted-foreground">
										{fuelType}
									</p>
								</div>
							))}
							{fuelTypes.map((fuelType) => (
								<div key={`${fuelType}-value`}>
									<p className="text-lg font-bold tabular-nums text-foreground">
										{formatFuelPrice(
											averagePrices[fuelType],
										)}
									</p>
								</div>
							))}
						</div>
					</div>
				</div>
				{headerFilters ? headerFilters : null}
				<div className="relative flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder={searchPlaceholder}
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>
			</div>

			{filteredStations.length === 0 ? (
				<div className="rounded-xl border border-dashed border-border bg-secondary/20 p-10 text-center text-sm text-muted-foreground">
					No stations found for the current filter.
				</div>
			) : (
				<div className="flex flex-col gap-3">
					<div className="overflow-hidden rounded-xl border border-border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<button
											type="button"
											onClick={() => toggleSort("name")}
											className="inline-flex items-center gap-2 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
										>
											Station Name
											{renderSortIcon("name")}
										</button>
									</TableHead>
									{fuelTypes.map((fuelType) => (
										<TableHead
											key={`${fuelType}-header`}
											className="text-right"
										>
											<button
												type="button"
												onClick={() =>
													toggleSort(fuelType)
												}
												className="ml-auto inline-flex items-center gap-2 text-right font-medium text-muted-foreground transition-colors hover:text-foreground"
											>
												{fuelType}
												{renderSortIcon(fuelType)}
											</button>
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedStations.map((station) => (
									<TableRow key={station.id}>
										<TableCell>
											<div className="min-w-[220px]">
												<p className="font-semibold text-foreground">
													{station.name}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{station.address}
												</p>
											</div>
										</TableCell>
										{fuelTypes.map((fuelType) => (
											<TableCell
												key={`${station.id}-${fuelType}`}
												className="text-right font-medium tabular-nums text-foreground"
											>
												{formatFuelPrice(
													getStationFuelPrice(
														station,
														fuelType,
													),
												)}
											</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					<AdminListPagination
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={setCurrentPage}
					/>
				</div>
			)}
		</div>
	);
}

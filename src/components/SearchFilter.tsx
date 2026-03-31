import { useEffect, useState } from "react";
import { FilterFuelType, SortOption, StatusFilter } from "@/types/station";
import { cn } from "@/lib/utils";
import { ArrowDownUp, ChevronDown, ChevronUp, MapPinned } from "lucide-react";
import { fuelTypes as availableFuelTypes } from "@/lib/fuel-prices";
import type {
	GeoCityMunicipality,
	GeoProvince,
} from "@/hooks/useGeoReferences";
import { GeoScopeFields } from "@/components/GeoScopeFields";

interface SearchFilterProps {
	searchQuery: string;
	onSearchChange: (q: string) => void;
	fuelFilter: FilterFuelType;
	onFuelFilterChange: (f: FilterFuelType) => void;
	statusFilter: StatusFilter;
	onStatusFilterChange: (status: StatusFilter) => void;
	sortBy: SortOption;
	onSortChange: (s: SortOption) => void;
	provinces?: GeoProvince[];
	cities?: GeoCityMunicipality[];
	provinceCode?: string;
	cityMunicipalityCode?: string;
	onProvinceChange?: (provinceCode: string) => void;
	onCityChange?: (cityCode: string) => void;
}

const fuelTypes: FilterFuelType[] = ["All", ...availableFuelTypes];
const statusOptions: StatusFilter[] = ["All", "Available", "Low", "Out"];
const sortOptions: { value: SortOption; label: string }[] = [
	{ value: "price_asc", label: "Low to High" },
	{ value: "price_desc", label: "High to Low" },
];

export function SearchFilter({
	searchQuery,
	onSearchChange,
	fuelFilter,
	onFuelFilterChange,
	statusFilter,
	onStatusFilterChange,
	sortBy,
	onSortChange,
	provinces,
	cities,
	provinceCode = "",
	cityMunicipalityCode = "",
	onProvinceChange,
	onCityChange,
}: SearchFilterProps) {
	const priceSortEnabled = fuelFilter !== "All";
	const showGeoFilters =
		!!provinces && !!cities && !!onProvinceChange && !!onCityChange;
	const hasActiveGeoFilter = !!provinceCode || !!cityMunicipalityCode;
	const [geoFiltersOpen, setGeoFiltersOpen] = useState(hasActiveGeoFilter);

	useEffect(() => {
		if (hasActiveGeoFilter) {
			setGeoFiltersOpen(true);
		}
	}, [hasActiveGeoFilter]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<input
					type="text"
					placeholder="Search stations..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					className="min-w-0 flex-1 rounded-sm border bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
				/>

				{showGeoFilters ? (
					<button
						type="button"
						onClick={() => setGeoFiltersOpen((current) => !current)}
						className={cn(
							"inline-flex h-[46px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium sovereign-ease transition-colors",
							hasActiveGeoFilter || geoFiltersOpen
								? "border-accent/30 bg-accent/10 text-accent"
								: "border-border bg-surface-alt text-muted-foreground hover:text-foreground",
						)}
					>
						<MapPinned className="h-4 w-4" />
						<span className="hidden sm:inline">Location</span>
						{hasActiveGeoFilter ? (
							<span className="h-1.5 w-1.5 rounded-full bg-current" />
						) : null}
						{geoFiltersOpen ? (
							<ChevronUp className="h-3.5 w-3.5" />
						) : (
							<ChevronDown className="h-3.5 w-3.5" />
						)}
					</button>
				) : null}
			</div>

			{showGeoFilters ? (
				<div className="flex flex-col gap-2">
					{geoFiltersOpen ? (
						<div className="rounded-xl border border-border bg-card p-3">
							<GeoScopeFields
								provinces={provinces}
								cities={cities}
								provinceCode={provinceCode}
								cityMunicipalityCode={cityMunicipalityCode}
								provincePlaceholder="All Provinces"
								cityPlaceholder="All Cities / Municipalities"
								cityRequired={false}
								onProvinceChange={onProvinceChange}
								onCityChange={onCityChange}
							/>
						</div>
					) : null}
				</div>
			) : null}

			<div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap justify-center">
				{/* Fuel type chips */}
				{fuelTypes.map((type) => (
					<button
						key={type}
						onClick={() => onFuelFilterChange(type)}
						className={cn(
							"shrink-0 rounded-full px-3 py-1.5 text-sm sovereign-ease transition-colors",
							fuelFilter === type
								? "bg-primary text-primary-foreground"
								: "bg-surface-alt text-muted-foreground hover:text-foreground",
						)}
					>
						{type}
					</button>
				))}

				<div className="md:ml-auto flex shrink-0 items-center gap-2">
					<select
						value={statusFilter}
						onChange={(e) =>
							onStatusFilterChange(e.target.value as StatusFilter)
						}
						className="rounded-full bg-surface-alt px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
					>
						{statusOptions.map((status) => (
							<option key={status} value={status}>
								{status === "All" ? "All Statuses" : status}
							</option>
						))}
					</select>

					<div className="flex shrink-0 items-center gap-1">
						<ArrowDownUp
							className={cn(
								"h-3.5 w-3.5",
								priceSortEnabled
									? "text-muted-foreground"
									: "text-muted-foreground/50",
							)}
						/>
						{sortOptions.map((opt) => (
							<button
								key={opt.value}
								onClick={() => onSortChange(opt.value)}
								disabled={!priceSortEnabled}
								className={cn(
									"rounded-full px-3 py-1.5 text-sm sovereign-ease transition-colors",
									priceSortEnabled && sortBy === opt.value
										? "bg-accent text-accent-foreground"
										: priceSortEnabled
											? "text-muted-foreground hover:text-foreground"
											: "cursor-not-allowed text-muted-foreground/50",
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

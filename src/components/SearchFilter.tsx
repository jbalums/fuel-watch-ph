import { FilterFuelType, SortOption, StatusFilter } from "@/types/station";
import { cn } from "@/lib/utils";
import { ArrowDownUp } from "lucide-react";

interface SearchFilterProps {
	searchQuery: string;
	onSearchChange: (q: string) => void;
	fuelFilter: FilterFuelType;
	onFuelFilterChange: (f: FilterFuelType) => void;
	statusFilter: StatusFilter;
	onStatusFilterChange: (status: StatusFilter) => void;
	sortBy: SortOption;
	onSortChange: (s: SortOption) => void;
}

const fuelTypes: FilterFuelType[] = ["All", "Unleaded", "Premium", "Diesel"];
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
}: SearchFilterProps) {
	const priceSortEnabled = fuelFilter !== "All";

	return (
		<div className="flex flex-col gap-3">
			{/* Search */}
			<input
				type="text"
				placeholder="Search stations..."
				value={searchQuery}
				onChange={(e) => onSearchChange(e.target.value)}
				className="w-full rounded-sm bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all border"
			/>

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

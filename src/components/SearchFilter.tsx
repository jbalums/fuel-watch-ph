import { FilterFuelType, SortOption } from "@/types/station";
import { cn } from "@/lib/utils";
import { ArrowDownUp } from "lucide-react";

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  fuelFilter: FilterFuelType;
  onFuelFilterChange: (f: FilterFuelType) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
}

const fuelTypes: FilterFuelType[] = ["All", "Unleaded", "Premium", "Diesel"];
const sortOptions: { value: SortOption; label: string }[] = [
  { value: "cheapest", label: "Cheapest" },
  { value: "status", label: "Status" },
];

export function SearchFilter({
  searchQuery,
  onSearchChange,
  fuelFilter,
  onFuelFilterChange,
  sortBy,
  onSortChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search stations..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 sovereign-ease transition-all"
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {/* Fuel type chips */}
        {fuelTypes.map((type) => (
          <button
            key={type}
            onClick={() => onFuelFilterChange(type)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-ui sovereign-ease transition-colors",
              fuelFilter === type
                ? "bg-primary text-primary-foreground"
                : "bg-surface-alt text-muted-foreground hover:text-foreground"
            )}
          >
            {type}
          </button>
        ))}

        {/* Sort */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-ui sovereign-ease transition-colors",
                sortBy === opt.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

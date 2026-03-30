import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
	GeoCityMunicipality,
	GeoProvince,
} from "@/hooks/useGeoReferences";
import { cn } from "@/lib/utils";

interface GeoScopeFieldsProps {
	provinces: GeoProvince[];
	cities: GeoCityMunicipality[];
	provinceCode: string;
	cityMunicipalityCode: string;
	requestedRole?: "province_admin" | "city_admin";
	provinceLabel?: string;
	cityLabel?: string;
	provincePlaceholder?: string;
	cityPlaceholder?: string;
	provinceDisabled?: boolean;
	cityDisabled?: boolean;
	cityRequired?: boolean;
	onProvinceChange: (provinceCode: string) => void;
	onCityChange: (cityCode: string) => void;
}

type GeoOption = {
	code: string;
	name: string;
};

function SearchableGeoSelect({
	label,
	value,
	options,
	placeholder,
	searchPlaceholder,
	emptyLabel,
	disabled = false,
	onChange,
}: {
	label: string;
	value: string;
	options: GeoOption[];
	placeholder: string;
	searchPlaceholder: string;
	emptyLabel: string;
	disabled?: boolean;
	onChange: (value: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const selectedOption = useMemo(
		() => options.find((option) => option.code === value) ?? null,
		[options, value],
	);

	return (
		<div className="flex flex-col gap-1.5">
			<label className="text-label text-muted-foreground">{label}</label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className={cn(
							"h-auto min-h-12 w-full justify-between rounded-xl border-border bg-background px-4 py-3 text-sm font-normal text-foreground hover:bg-background",
							!selectedOption && "text-muted-foreground",
						)}
					>
						<span className="truncate text-left">
							{selectedOption?.name ?? placeholder}
						</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
					<Command>
						<CommandInput placeholder={searchPlaceholder} />
						<CommandList>
							<CommandEmpty>{emptyLabel}</CommandEmpty>
							{options.map((option) => (
								<CommandItem
									key={option.code}
									value={`${option.name} ${option.code}`}
									onSelect={() => {
										onChange(option.code);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											value === option.code
												? "opacity-100"
												: "opacity-0",
										)}
									/>
									{option.name}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}

export function GeoScopeFields({
	provinces,
	cities,
	provinceCode,
	cityMunicipalityCode,
	requestedRole,
	provinceLabel = "Province",
	cityLabel = "City / Municipality",
	provincePlaceholder = "Select province",
	cityPlaceholder = "Select city or municipality",
	provinceDisabled = false,
	cityDisabled = false,
	cityRequired = requestedRole === "city_admin",
	onProvinceChange,
	onCityChange,
}: GeoScopeFieldsProps) {
	return (
		<div className="grid gap-3 md:grid-cols-2">
			<SearchableGeoSelect
				label={provinceLabel}
				value={provinceCode}
				options={provinces.map((province) => ({
					code: province.code,
					name: province.name,
				}))}
				placeholder={provincePlaceholder}
				searchPlaceholder="Search provinces..."
				emptyLabel="No provinces found."
				disabled={provinceDisabled}
				onChange={onProvinceChange}
			/>

			<SearchableGeoSelect
				label={`${cityLabel}${cityRequired ? "" : " (Optional)"}`}
				value={cityMunicipalityCode}
				options={cities.map((city) => ({
					code: city.code,
					name: city.name,
				}))}
				placeholder={
					provinceCode ? cityPlaceholder : "Select a province first"
				}
				searchPlaceholder="Search cities or municipalities..."
				emptyLabel={
					provinceCode
						? "No cities or municipalities found."
						: "Select a province first."
				}
				disabled={cityDisabled || !provinceCode}
				onChange={onCityChange}
			/>
		</div>
	);
}

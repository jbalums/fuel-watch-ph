import type {
	GeoCityMunicipality,
	GeoProvince,
} from "@/hooks/useGeoReferences";

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
			<div className="flex flex-col gap-1.5">
				<label className="text-label text-muted-foreground">
					{provinceLabel}
				</label>
				<select
					value={provinceCode}
					onChange={(event) => onProvinceChange(event.target.value)}
					disabled={provinceDisabled}
					className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
				>
					<option value="">{provincePlaceholder}</option>
					{provinces.map((province) => (
						<option key={province.code} value={province.code}>
							{province.name}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-label text-muted-foreground">
					{cityLabel}
					{cityRequired ? "" : " (Optional)"}
				</label>
				<select
					value={cityMunicipalityCode}
					onChange={(event) => onCityChange(event.target.value)}
					disabled={cityDisabled || !provinceCode}
					className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
				>
					<option value="">
						{provinceCode
							? cityPlaceholder
							: "Select a province first"}
					</option>
					{cities.map((city) => (
						<option key={city.code} value={city.code}>
							{city.name}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}

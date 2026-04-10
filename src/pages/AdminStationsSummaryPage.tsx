import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { StationsSummaryView } from "@/components/stations/StationsSummaryView";
import { useAdminStations } from "@/components/admin/admin-shared";
import { useGeoReferences } from "@/hooks/useGeoReferences";

export default function AdminStationsSummaryPage() {
	const { data: stations = [], isLoading } = useAdminStations();
	const { provinces, citiesByProvince } = useGeoReferences();
	const [provinceCode, setProvinceCode] = useState("");
	const [cityMunicipalityCode, setCityMunicipalityCode] = useState("");

	const visibleCities = useMemo(
		() => (provinceCode ? (citiesByProvince.get(provinceCode) ?? []) : []),
		[citiesByProvince, provinceCode],
	);
	const filteredStations = useMemo(() => {
		return stations.filter((station) => {
			if (provinceCode && station.province_code !== provinceCode) {
				return false;
			}

			if (
				cityMunicipalityCode &&
				station.city_municipality_code !== cityMunicipalityCode
			) {
				return false;
			}

			return true;
		});
	}, [cityMunicipalityCode, provinceCode, stations]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<StationsSummaryView
			title="Stations Summary"
			description="Review current station coverage and average fuel prices across all listed stations."
			stations={filteredStations}
			searchPlaceholder="Search stations"
			headerFilters={
				<div className="rounded-2xl border border-border bg-secondary/20 p-4">
					<div className="mb-3">
						<p className="text-sm font-medium text-foreground">
							Location Filter
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Filter the summary and station list by province or
							city / municipality.
						</p>
					</div>
					<GeoScopeFields
						provinces={provinces}
						cities={visibleCities}
						provinceCode={provinceCode}
						cityMunicipalityCode={cityMunicipalityCode}
						provincePlaceholder="All Provinces"
						cityPlaceholder="All Cities / Municipalities"
						cityRequired={false}
						onProvinceChange={(nextProvinceCode) => {
							setProvinceCode(nextProvinceCode);
							setCityMunicipalityCode("");
						}}
						onCityChange={setCityMunicipalityCode}
					/>
				</div>
			}
		/>
	);
}

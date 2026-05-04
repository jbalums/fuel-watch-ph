import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { StationsSummaryView } from "@/components/stations/StationsSummaryView";
import {
	useAdminStations,
	useAdminStationSummaryPricesAsOf,
} from "@/components/admin/admin-shared";
import { useGeoReferences } from "@/hooks/useGeoReferences";

function buildManilaEndOfDayIso(dateValue: string) {
	if (!dateValue) {
		return null;
	}

	return new Date(`${dateValue}T23:59:59.999+08:00`).toISOString();
}

function formatAsOfDateLabel(dateValue: string) {
	if (!dateValue) {
		return null;
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "Asia/Manila",
	}).format(new Date(`${dateValue}T12:00:00+08:00`));
}

export default function AdminStationsSummaryPage() {
	const [provinceCode, setProvinceCode] = useState("");
	const [cityMunicipalityCode, setCityMunicipalityCode] = useState("");
	const [asOfDate, setAsOfDate] = useState("");
	const { provinces, citiesByProvince } = useGeoReferences({ provinceCode });
	const asOfTimestamp = useMemo(
		() => buildManilaEndOfDayIso(asOfDate),
		[asOfDate],
	);
	const asOfDateLabel = useMemo(
		() => formatAsOfDateLabel(asOfDate),
		[asOfDate],
	);
	const { data: currentStations = [], isLoading: currentLoading } =
		useAdminStations(!asOfTimestamp);
	const {
		data: historicalStations = [],
		isLoading: historicalLoading,
	} = useAdminStationSummaryPricesAsOf({
		asOf: asOfTimestamp,
		provinceCode,
		cityMunicipalityCode,
	});

	const visibleCities = useMemo(
		() => (provinceCode ? (citiesByProvince.get(provinceCode) ?? []) : []),
		[citiesByProvince, provinceCode],
	);
	const filteredStations = useMemo(() => {
		if (asOfTimestamp) {
			return historicalStations;
		}

		return currentStations.filter((station) => {
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
	}, [
		asOfTimestamp,
		cityMunicipalityCode,
		currentStations,
		historicalStations,
		provinceCode,
	]);
	const isLoading = asOfTimestamp ? historicalLoading : currentLoading;

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
			description={
				asOfDateLabel
					? "Review historical station coverage and fuel prices from approved report history."
					: "Review current station coverage and average fuel prices across all listed stations."
			}
			stations={filteredStations}
			searchPlaceholder="Search stations"
			asOfDateLabel={asOfDateLabel}
			headerFilters={
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
					<div className="rounded-2xl border border-border bg-secondary/20 p-4">
						<div className="mb-3">
							<p className="text-sm font-medium text-foreground">
								Location Filter
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Filter the summary and station list by province
								or city / municipality.
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
					<div className="rounded-2xl border border-border bg-secondary/20 p-4">
						<div className="mb-3">
							<p className="text-sm font-medium text-foreground">
								As of date
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Leave blank to show current station prices.
							</p>
						</div>
						<div className="flex gap-2">
							<input
								type="date"
								value={asOfDate}
								onChange={(event) =>
									setAsOfDate(event.target.value)
								}
								className="min-h-10 w-full rounded-xl bg-surface-alt px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
							{asOfDate ? (
								<button
									type="button"
									onClick={() => setAsOfDate("")}
									className="rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
								>
									Clear
								</button>
							) : null}
						</div>
					</div>
				</div>
			}
		/>
	);
}

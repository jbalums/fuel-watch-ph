import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { StationMap } from "@/components/StationMap";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useStations } from "@/hooks/useStations";
import { useUserAccess } from "@/hooks/useUserAccess";
import { cn } from "@/lib/utils";
import type { CoordinatePair } from "@/lib/google-maps";
import { ChevronDown, ChevronUp, MapPinned } from "lucide-react";

type MapPageLocationState = {
	reportLocation?: CoordinatePair & {
		label?: string;
	};
};

export default function MapPage() {
	const { data: stations = [] } = useStations();
	const { isLguOperator } = useUserAccess();
	const { data: currentUserScope } = useCurrentUserScope(isLguOperator);
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const stationParam = searchParams.get("station");
	const provinceCode = searchParams.get("provinceCode") ?? "";
	const cityMunicipalityCode = searchParams.get("cityMunicipalityCode") ?? "";
	const { provinces, citiesByProvince } = useGeoReferences({ provinceCode });
	const hasInitializedScopeFilters = useRef(false);
	const hasActiveGeoFilter = !!provinceCode || !!cityMunicipalityCode;
	const [locationFiltersOpen, setLocationFiltersOpen] = useState(false);
	const reportLocation = useMemo(() => {
		const state = location.state as MapPageLocationState | null;
		const candidate = state?.reportLocation;

		if (!candidate) {
			return null;
		}

		if (
			!Number.isFinite(candidate.lat) ||
			!Number.isFinite(candidate.lng)
		) {
			return null;
		}

		return candidate;
	}, [location.state]);
	const availableCities = useMemo(
		() => (provinceCode ? (citiesByProvince.get(provinceCode) ?? []) : []),
		[citiesByProvince, provinceCode],
	);
	const filteredStations = useMemo(() => {
		return stations.filter((station) => {
			if (provinceCode && station.provinceCode !== provinceCode) {
				return false;
			}

			if (
				cityMunicipalityCode &&
				station.cityMunicipalityCode !== cityMunicipalityCode
			) {
				return false;
			}

			return true;
		});
	}, [cityMunicipalityCode, provinceCode, stations]);
	const selectedStationId = useMemo(() => {
		if (!stationParam) {
			return null;
		}

		return filteredStations.some((station) => station.id === stationParam)
			? stationParam
			: null;
	}, [filteredStations, stationParam]);

	useEffect(() => {
		if (
			!isLguOperator ||
			!currentUserScope ||
			hasInitializedScopeFilters.current ||
			provinceCode
		) {
			return;
		}

		const nextParams = new URLSearchParams(searchParams);
		nextParams.set("provinceCode", currentUserScope.provinceCode);

		if (
			currentUserScope.scopeType === "city" &&
			currentUserScope.cityMunicipalityCode
		) {
			nextParams.set(
				"cityMunicipalityCode",
				currentUserScope.cityMunicipalityCode,
			);
		}

		setSearchParams(nextParams, { replace: true });
		hasInitializedScopeFilters.current = true;
	}, [
		cityMunicipalityCode,
		currentUserScope,
		isLguOperator,
		provinceCode,
		searchParams,
		setSearchParams,
	]);

	const updateLocationFilters = (
		nextProvinceCode: string,
		nextCityMunicipalityCode: string,
	) => {
		const nextParams = new URLSearchParams(searchParams);

		if (nextProvinceCode) {
			nextParams.set("provinceCode", nextProvinceCode);
		} else {
			nextParams.delete("provinceCode");
		}

		if (nextCityMunicipalityCode) {
			nextParams.set("cityMunicipalityCode", nextCityMunicipalityCode);
		} else {
			nextParams.delete("cityMunicipalityCode");
		}

		setSearchParams(nextParams, { replace: true });
	};

	return (
		<div className="flex flex-col">
			<StationMap
				stations={filteredStations}
				allStations={stations}
				focusedStationId={selectedStationId}
				highlightLocation={reportLocation}
				provinceCode={provinceCode}
				cityMunicipalityCode={cityMunicipalityCode}
				onFocusedStationChange={(stationId) => {
					const nextParams = new URLSearchParams(searchParams);
					if (stationId) {
						nextParams.set("station", stationId);
					} else {
						nextParams.delete("station");
					}
					setSearchParams(nextParams, { replace: true });
				}}
			/>
		</div>
	);
}

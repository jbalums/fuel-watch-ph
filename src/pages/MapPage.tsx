import { useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { StationMap } from "@/components/StationMap";
import { useStations } from "@/hooks/useStations";
import type { CoordinatePair } from "@/lib/google-maps";

type MapPageLocationState = {
	reportLocation?: CoordinatePair & {
		label?: string;
	};
};

export default function MapPage() {
	const { data: stations = [] } = useStations();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const stationParam = searchParams.get("station");
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
	const selectedStationId = useMemo(() => {
		if (!stationParam) {
			return null;
		}

		return stations.some((station) => station.id === stationParam)
			? stationParam
			: null;
	}, [stationParam, stations]);

	return (
		<StationMap
			stations={stations}
			focusedStationId={selectedStationId}
			highlightLocation={reportLocation}
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
	);
}

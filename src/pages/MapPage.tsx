import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { StationMap } from "@/components/StationMap";
import { useStations } from "@/hooks/useStations";

export default function MapPage() {
	const { data: stations = [] } = useStations();
	const [searchParams, setSearchParams] = useSearchParams();
	const stationParam = searchParams.get("station");
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

import { StationMap } from "@/components/StationMap";
import { useStations } from "@/hooks/useStations";

export default function MapPage() {
	const { data: stations = [] } = useStations();

	return <StationMap stations={stations} />;
}

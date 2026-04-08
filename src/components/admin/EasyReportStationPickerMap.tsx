import { useEffect, useMemo, useRef, useState } from "react";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
} from "@react-google-maps/api";
import { Loader2, MapPinned } from "lucide-react";
import { useStationBrandLogos } from "@/hooks/useStationBrandLogos";
import { buildResolvedStationMarkerIcon } from "@/lib/station-brand-logos";
import {
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_CONTAINER_STYLE,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	MANILA_CENTER,
	type CoordinatePair,
} from "@/lib/google-maps";

type StationCandidate = {
	id: string;
	name: string | null;
	address: string | null;
	lat: number;
	lng: number;
	status: string | null;
	stationBrandLogoId: string | null;
};

interface EasyReportStationPickerMapProps {
	reportLocation: CoordinatePair | null;
	stations: StationCandidate[];
	selectedStationId: string;
	onStationSelect: (stationId: string) => void;
}

function buildReportPinIcon(googleMaps: typeof google.maps) {
	return {
		path: googleMaps.SymbolPath.CIRCLE,
		scale: 10,
		fillColor: "#2563eb",
		fillOpacity: 1,
		strokeColor: "#ffffff",
		strokeWeight: 3,
	} satisfies google.maps.Symbol;
}

function GoogleEasyReportStationPickerMap({
	reportLocation,
	stations,
	selectedStationId,
	onStationSelect,
}: EasyReportStationPickerMapProps) {
	const { data: stationBrandLogos = [] } = useStationBrandLogos();
	const [openInfoStationId, setOpenInfoStationId] = useState<string | null>(
		null,
	);
	const mapRef = useRef<google.maps.Map | null>(null);
	const googleMaps =
		typeof window !== "undefined" ? window.google?.maps : undefined;

	const selectedStation = useMemo(
		() =>
			selectedStationId
				? stations.find((station) => station.id === selectedStationId) ??
					null
				: null,
		[selectedStationId, stations],
	);

	const visibleStations = useMemo(() => {
		if (!reportLocation) {
			return stations.slice(0, 80);
		}

		return [...stations]
			.map((station) => ({
				...station,
				distanceScore:
					Math.abs(station.lat - reportLocation.lat) +
					Math.abs(station.lng - reportLocation.lng),
			}))
			.sort((left, right) => left.distanceScore - right.distanceScore)
			.slice(0, 80);
	}, [reportLocation, stations]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !reportLocation) {
			return;
		}

		map.panTo(reportLocation);
		map.setZoom(15);
	}, [reportLocation]);

	useEffect(() => {
		if (!selectedStationId) {
			setOpenInfoStationId(null);
		}
	}, [selectedStationId]);

	return (
		<div className="rounded-xl border border-border bg-background p-3">
			<div className="mb-3 flex items-start gap-2">
				<MapPinned className="mt-0.5 h-4 w-4 text-accent" />
				<div>
					<p className="text-sm font-medium text-foreground">
						Match Nearby Station
					</p>
					<p className="text-xs text-muted-foreground">
						Click a nearby gas station marker to use it for this
						Easy Report. The blue marker is the reporter's pinned
						location.
					</p>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-border">
				<GoogleMap
					mapContainerStyle={{
						...GOOGLE_MAPS_CONTAINER_STYLE,
						height: "320px",
					}}
					center={reportLocation ?? MANILA_CENTER}
					zoom={15}
					onLoad={(map) => {
						mapRef.current = map;
					}}
					onUnmount={() => {
						mapRef.current = null;
					}}
					options={{
						fullscreenControl: true,
						mapTypeControl: true,
						streetViewControl: false,
						gestureHandling: "greedy",
					}}
				>
					{reportLocation && googleMaps ? (
						<MarkerF
							position={reportLocation}
							icon={buildReportPinIcon(googleMaps)}
						/>
					) : null}

					{googleMaps
						? visibleStations.map((station) => (
								<MarkerF
									key={station.id}
										position={{ lat: station.lat, lng: station.lng }}
										icon={buildResolvedStationMarkerIcon(
											googleMaps,
											{
												name: station.name ?? "Unnamed station",
												stationBrandLogoId:
													station.stationBrandLogoId,
											},
											stationBrandLogos,
											{
												isSelected:
													station.id === selectedStationId,
											},
										)}
									onClick={() => {
										onStationSelect(station.id);
										setOpenInfoStationId(station.id);
									}}
								>
									{openInfoStationId === station.id ? (
										<InfoWindowF
											position={{
												lat: station.lat,
												lng: station.lng,
											}}
											onCloseClick={() =>
												setOpenInfoStationId(null)
											}
										>
											<div className="max-w-[240px] pr-2 text-sm">
												<p className="font-semibold text-foreground">
													{station.name ?? "Unnamed station"}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{station.address ?? "No address"}
												</p>
												<button
													type="button"
													onClick={() =>
														onStationSelect(station.id)
													}
													className="mt-2 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
												>
													Use this station
												</button>
											</div>
										</InfoWindowF>
									) : null}
								</MarkerF>
							))
						: null}
				</GoogleMap>
			</div>

			<p className="mt-2 text-xs text-muted-foreground">
				{selectedStation
					? `Selected station: ${selectedStation.name ?? "Unnamed station"}`
					: "No station selected on the map yet."}
			</p>
		</div>
	);
}

export function EasyReportStationPickerMap(
	props: EasyReportStationPickerMapProps,
) {
	if (!props.reportLocation) {
		return (
			<div className="rounded-xl border border-border bg-background p-4">
				<div className="flex items-start gap-2">
					<MapPinned className="mt-0.5 h-4 w-4 text-warning" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Report location is unavailable
						</p>
						<p className="text-xs text-muted-foreground">
							Use the station dropdown below to match this Easy
							Report manually.
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (!GOOGLE_MAPS_API_KEY) {
		return (
			<div className="rounded-xl border border-border bg-background p-4">
				<div className="flex items-start gap-2">
					<MapPinned className="mt-0.5 h-4 w-4 text-warning" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Google Maps is not configured
						</p>
						<p className="text-xs text-muted-foreground">
							Add `VITE_GOOGLE_MAPS_API_KEY` to match Easy Reports
							by map.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<LoadScriptNext
			id={GOOGLE_MAPS_SCRIPT_ID}
			googleMapsApiKey={GOOGLE_MAPS_API_KEY}
			libraries={GOOGLE_MAPS_LIBRARIES}
			loadingElement={
				<div className="rounded-xl border border-border bg-background p-4">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading station map...
					</div>
				</div>
			}
		>
			<GoogleEasyReportStationPickerMap {...props} />
		</LoadScriptNext>
	);
}

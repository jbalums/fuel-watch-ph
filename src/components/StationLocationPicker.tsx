import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin } from "lucide-react";
import {
	BASEMAP_CONFIG,
	type BasemapOption,
	MANILA_CENTER,
} from "@/lib/leaflet";
import fuelWatchLogo from "@/assets/images/Icon.png";

type CoordinateStrings = {
	lat: string;
	lng: string;
};

type ExistingStationLocation = {
	lat: number;
	lng: number;
};

interface StationLocationPickerProps {
	value: CoordinateStrings;
	onChange: (coords: CoordinateStrings) => void;
	onAddressResolved?: (address: string) => void;
	existingStations?: ExistingStationLocation[];
}

type ReverseGeocodeResponse = {
	display_name?: string;
};

function parseCoordinates(value: CoordinateStrings): [number, number] | null {
	const lat = Number.parseFloat(value.lat);
	const lng = Number.parseFloat(value.lng);

	if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

	return [lat, lng];
}

function formatCoordinate(value: number) {
	return value.toFixed(6);
}

function deriveExistingCenter(stations: ExistingStationLocation[]) {
	if (stations.length === 0) return null;

	const bounds = L.latLngBounds(
		stations.map((station) => [station.lat, station.lng]),
	);
	const center = bounds.getCenter();
	return [center.lat, center.lng] as [number, number];
}

function MapViewportController({ center }: { center: [number, number] }) {
	const map = useMap();

	useEffect(() => {
		map.setView(center, map.getZoom(), { animate: false });
	}, [center, map]);

	return null;
}

function PickerEvents({
	onPick,
}: {
	onPick: (coords: [number, number]) => void;
}) {
	useMapEvents({
		click(event) {
			onPick([event.latlng.lat, event.latlng.lng]);
		},
	});

	return null;
}

export function StationLocationPicker({
	value,
	onChange,
	onAddressResolved,
	existingStations = [],
}: StationLocationPickerProps) {
	const selectedPosition = useMemo(() => parseCoordinates(value), [value]);
	const existingCenter = useMemo(
		() => deriveExistingCenter(existingStations),
		[existingStations],
	);
	const [viewportCenter, setViewportCenter] = useState<[number, number]>(
		selectedPosition ?? existingCenter ?? MANILA_CENTER,
	);
	const [basemap, setBasemap] = useState<BasemapOption>("standard");
	const [isResolvingAddress, setIsResolvingAddress] = useState(false);
	const [addressError, setAddressError] = useState<string | null>(null);
	const lastResolvedCoordinates = useRef<string | null>(null);

	const resolveAddress = useCallback(
		async (
			coordinates: [number, number],
			options?: { force?: boolean },
		) => {
			const coordinatesKey = coordinates
				.map((coordinate) => coordinate.toFixed(6))
				.join(",");

			if (
				!options?.force &&
				lastResolvedCoordinates.current === coordinatesKey
			) {
				return;
			}

			setIsResolvingAddress(true);
			setAddressError(null);

			try {
				const params = new URLSearchParams({
					format: "jsonv2",
					lat: String(coordinates[0]),
					lon: String(coordinates[1]),
					zoom: "18",
					addressdetails: "1",
				});

				const response = await fetch(
					`https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
					{
						headers: {
							Accept: "application/json",
							"Accept-Language": "en",
						},
					},
				);

				if (!response.ok) {
					throw new Error(
						"Could not resolve address for these coordinates",
					);
				}

				const data = (await response.json()) as ReverseGeocodeResponse;
				const displayAddress = data.display_name?.trim();

				if (!displayAddress) {
					throw new Error(
						"No address was returned for these coordinates",
					);
				}

				lastResolvedCoordinates.current = coordinatesKey;
				onAddressResolved?.(displayAddress);
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Could not resolve address for these coordinates";
				setAddressError(message);
			} finally {
				setIsResolvingAddress(false);
			}
		},
		[onAddressResolved],
	);
	useEffect(() => {
		if (selectedPosition) {
			setViewportCenter(selectedPosition);
		}
	}, [selectedPosition]);

	useEffect(() => {
		if (!selectedPosition && existingCenter) {
			setViewportCenter(existingCenter);
		}
	}, [existingCenter, resolveAddress, selectedPosition]);

	useEffect(() => {
		if (selectedPosition || existingCenter || !navigator.geolocation)
			return;
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setViewportCenter([
					position.coords.latitude,
					position.coords.longitude,
				]);
			},
			() => {
				setViewportCenter(MANILA_CENTER);
			},
		);
	}, [existingCenter, selectedPosition]);

	const handlePick = ([lat, lng]: [number, number]) => {
		onChange({
			lat: formatCoordinate(lat),
			lng: formatCoordinate(lng),
		});
	};

	const customIcon = new L.Icon({
		iconUrl: fuelWatchLogo,
		iconSize: [45, 45], // Size of the icon
		iconAnchor: [17, 45], // Point of the icon which will correspond to marker's location
		popupAnchor: [0, -40], // Point from which the popup should open relative to the iconAnchor
	});

	useEffect(() => {
		if (!selectedPosition || !onAddressResolved) return;

		const timeoutId = window.setTimeout(() => {
			void resolveAddress(selectedPosition);
		}, 500);

		return () => window.clearTimeout(timeoutId);
	}, [onAddressResolved, resolveAddress, selectedPosition]);

	const activeBasemap = BASEMAP_CONFIG[basemap];

	return (
		<div className="rounded-xl border border-border bg-background p-3 md:col-span-2">
			<div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="flex items-start gap-2">
					<MapPin className="mt-0.5 h-4 w-4 text-accent" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Location Picker
						</p>
						<p className="text-xs text-muted-foreground">
							Click the map or drag the marker to update latitude
							and longitude.
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{(
						Object.entries(BASEMAP_CONFIG) as Array<
							[
								BasemapOption,
								(typeof BASEMAP_CONFIG)[BasemapOption],
							]
						>
					).map(([option, config]) => (
						<button
							key={option}
							type="button"
							onClick={() => setBasemap(option)}
							className={`rounded-full px-3 py-1.5 text-xs font-medium ${
								basemap === option
									? "bg-primary text-primary-foreground"
									: "bg-surface-alt text-muted-foreground hover:text-foreground"
							}`}
						>
							{config.label}
						</button>
					))}
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-border">
				<MapContainer
					center={viewportCenter}
					zoom={20}
					scrollWheelZoom
					className="h-[500px] w-full"
					style={{ background: "hsl(222 47% 11%)" }}
				>
					<TileLayer
						attribution={activeBasemap.attribution}
						url={activeBasemap.url}
					/>
					<MapViewportController
						center={selectedPosition ?? viewportCenter}
					/>
					<PickerEvents onPick={handlePick} />

					{selectedPosition && (
						<Marker
							position={selectedPosition}
							draggable
							icon={customIcon}
							eventHandlers={{
								dragend: (event) => {
									const marker = event.target as L.Marker;
									const markerPosition = marker.getLatLng();
									handlePick([
										markerPosition.lat,
										markerPosition.lng,
									]);
								},
							}}
						>
							<Popup>
								<div className="text-sm">
									<p className="font-medium">
										Selected coordinates
									</p>
									<p>
										{selectedPosition[0].toFixed(6)},{" "}
										{selectedPosition[1].toFixed(6)}
									</p>
								</div>
							</Popup>
						</Marker>
					)}
				</MapContainer>
			</div>

			<div className="flex items-center justify-between gap-5">
				<p className="mt-2 text-xs text-muted-foreground">
					{selectedPosition
						? `Selected: ${selectedPosition[0].toFixed(6)}, ${selectedPosition[1].toFixed(6)}`
						: "No valid coordinates selected yet."}
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => {
							if (!selectedPosition) return;
							void resolveAddress(selectedPosition, {
								force: true,
							});
						}}
						disabled={!selectedPosition || isResolvingAddress}
						className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isResolvingAddress && (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						)}
						Use current coordinates for address
					</button>
					{isResolvingAddress && (
						<span className="text-xs text-muted-foreground">
							Resolving current address...
						</span>
					)}
					{addressError && (
						<span className="text-xs text-destructive">
							{addressError}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

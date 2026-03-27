import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	GoogleMap,
	LoadScriptNext,
	MarkerF,
} from "@react-google-maps/api";
import { Loader2, MapPin } from "lucide-react";
import fuelWatchLogo from "@/assets/images/Icon.png";
import {
	deriveCenterFromLocations,
	formatCoordinate,
	GOOGLE_BASEMAP_CONFIG,
	type GoogleBasemapOption,
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_CONTAINER_STYLE,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	MANILA_CENTER,
	parseCoordinateStrings,
} from "@/lib/google-maps";

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

function GoogleStationLocationPicker({
	value,
	onChange,
	onAddressResolved,
	existingStations = [],
}: StationLocationPickerProps) {
	const selectedPosition = useMemo(
		() => parseCoordinateStrings(value),
		[value],
	);
	const existingCenter = useMemo(
		() => deriveCenterFromLocations(existingStations),
		[existingStations],
	);
	const [viewportCenter, setViewportCenter] = useState(
		selectedPosition ?? existingCenter ?? MANILA_CENTER,
	);
	const [basemap, setBasemap] = useState<GoogleBasemapOption>("standard");
	const [isResolvingAddress, setIsResolvingAddress] = useState(false);
	const [addressError, setAddressError] = useState<string | null>(null);
	const lastResolvedCoordinates = useRef<string | null>(null);
	const mapRef = useRef<google.maps.Map | null>(null);
	const geocoderRef = useRef<google.maps.Geocoder | null>(null);

	useEffect(() => {
		if (selectedPosition) {
			setViewportCenter(selectedPosition);
		}
	}, [selectedPosition]);

	useEffect(() => {
		if (!selectedPosition && existingCenter) {
			setViewportCenter(existingCenter);
		}
	}, [existingCenter, selectedPosition]);

	useEffect(() => {
		if (selectedPosition || existingCenter || !navigator.geolocation) {
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				setViewportCenter({
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				});
			},
			() => {
				setViewportCenter(MANILA_CENTER);
			},
		);
	}, [existingCenter, selectedPosition]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) {
			return;
		}

		const targetCenter = selectedPosition ?? viewportCenter;
		map.panTo(targetCenter);

		if (selectedPosition) {
			map.setZoom(18);
		}
	}, [selectedPosition, viewportCenter]);

	const handlePick = useCallback(
		(coordinates: { lat: number; lng: number }) => {
			onChange({
				lat: formatCoordinate(coordinates.lat),
				lng: formatCoordinate(coordinates.lng),
			});
		},
		[onChange],
	);

	const resolveAddress = useCallback(
		async (
			coordinates: { lat: number; lng: number },
			options?: { force?: boolean },
		) => {
			if (!onAddressResolved) {
				return;
			}

			const coordinatesKey = [
				coordinates.lat.toFixed(6),
				coordinates.lng.toFixed(6),
			].join(",");

			if (
				!options?.force &&
				lastResolvedCoordinates.current === coordinatesKey
			) {
				return;
			}

			setIsResolvingAddress(true);
			setAddressError(null);

			try {
				const geocoder =
					geocoderRef.current ??
					new window.google.maps.Geocoder();
				geocoderRef.current = geocoder;

				const response = await geocoder.geocode({
					location: coordinates,
				});
				const formattedAddress = response.results
					.find((result) => result.formatted_address?.trim())
					?.formatted_address?.trim();

				if (!formattedAddress) {
					throw new Error(
						"No address was returned for these coordinates",
					);
				}

				lastResolvedCoordinates.current = coordinatesKey;
				onAddressResolved(formattedAddress);
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
		if (!selectedPosition || !onAddressResolved) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			void resolveAddress(selectedPosition);
		}, 500);

		return () => window.clearTimeout(timeoutId);
	}, [onAddressResolved, resolveAddress, selectedPosition]);

	const markerIcon = useMemo<google.maps.Icon>(() => {
		return {
			url: fuelWatchLogo,
			scaledSize: new window.google.maps.Size(45, 45),
			anchor: new window.google.maps.Point(22, 45),
		};
	}, []);

	const activeBasemap = GOOGLE_BASEMAP_CONFIG[basemap];

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
						Object.entries(GOOGLE_BASEMAP_CONFIG) as Array<
							[
								GoogleBasemapOption,
								(typeof GOOGLE_BASEMAP_CONFIG)[GoogleBasemapOption],
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
				<GoogleMap
					mapContainerStyle={{
						...GOOGLE_MAPS_CONTAINER_STYLE,
						height: "500px",
					}}
					center={selectedPosition ?? viewportCenter}
					zoom={18}
					onLoad={(map) => {
						mapRef.current = map;
					}}
					onUnmount={() => {
						mapRef.current = null;
					}}
					onClick={(event) => {
						const latLng = event.latLng;
						if (!latLng) {
							return;
						}

						handlePick({
							lat: latLng.lat(),
							lng: latLng.lng(),
						});
					}}
					options={{
						fullscreenControl: true,
						mapTypeControl: false,
						streetViewControl: false,
						gestureHandling: "greedy",
						mapTypeId: activeBasemap.mapTypeId,
					}}
				>
					{selectedPosition && (
						<MarkerF
							position={selectedPosition}
							draggable
							icon={markerIcon}
							onDragEnd={(event) => {
								const latLng = event.latLng;
								if (!latLng) {
									return;
								}

								handlePick({
									lat: latLng.lat(),
									lng: latLng.lng(),
								});
							}}
						/>
					)}
				</GoogleMap>
			</div>

			<div className="flex items-center justify-between gap-5">
				<p className="mt-2 text-xs text-muted-foreground">
					{selectedPosition
						? `Selected: ${selectedPosition.lat.toFixed(6)}, ${selectedPosition.lng.toFixed(6)}`
						: "No valid coordinates selected yet."}
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => {
							if (!selectedPosition) {
								return;
							}

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

export function StationLocationPicker(props: StationLocationPickerProps) {
	if (!GOOGLE_MAPS_API_KEY) {
		return (
			<div className="rounded-xl border border-border bg-background p-4 md:col-span-2">
				<div className="flex items-start gap-2">
					<MapPin className="mt-0.5 h-4 w-4 text-warning" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Google Maps is not configured
						</p>
						<p className="text-xs text-muted-foreground">
							Add `VITE_GOOGLE_MAPS_API_KEY` to enable visual
							location picking and address lookup.
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
				<div className="rounded-xl border border-border bg-background p-4 md:col-span-2">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading Google Maps...
					</div>
				</div>
			}
		>
			<GoogleStationLocationPicker {...props} />
		</LoadScriptNext>
	);
}

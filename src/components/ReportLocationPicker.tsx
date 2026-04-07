import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	GoogleMap,
	InfoWindowF,
	LoadScriptNext,
	MarkerF,
} from "@react-google-maps/api";
import { Loader2, MapPin, MapPinned } from "lucide-react";
import type { GasStation, StationStatus } from "@/types/station";
import {
	deriveCenterFromLocations,
	formatCoordinate,
	GOOGLE_MAPS_API_KEY,
	GOOGLE_MAPS_CONTAINER_STYLE,
	GOOGLE_MAPS_LIBRARIES,
	GOOGLE_MAPS_SCRIPT_ID,
	MANILA_CENTER,
	type CoordinatePair,
} from "@/lib/google-maps";
import { StationMarkerInfoWindow } from "@/components/StationMarkerInfoWindow";

const statusColors: Record<StationStatus, string> = {
	Available: "#22c55e",
	Low: "#f59e0b",
	Out: "#ef4444",
};

type ReportLocationSelection = {
	stationId: string | null;
	lat: number;
	lng: number;
	reportedAddress: string;
};

interface ReportLocationPickerProps {
	stations: GasStation[];
	selectedStationId: string | null;
	selectedPosition: CoordinatePair | null;
	selectedAddress: string | null;
	autoPinCurrentLocation?: boolean;
	onSelectExistingStation: (station: GasStation) => void;
	onSelectNewLocation: (selection: ReportLocationSelection) => void;
	onClearSelection: () => void;
}

function buildPinnedLocationLabel(coordinates: CoordinatePair) {
	return `Pinned location (${formatCoordinate(coordinates.lat)}, ${formatCoordinate(coordinates.lng)})`;
}

function coordinatesMatch(
	left: CoordinatePair | null,
	right: CoordinatePair | null,
) {
	return left?.lat === right?.lat && left?.lng === right?.lng;
}

function GoogleReportLocationPicker({
	stations,
	selectedStationId,
	selectedPosition,
	selectedAddress,
	autoPinCurrentLocation = false,
	onSelectExistingStation,
	onSelectNewLocation,
	onClearSelection,
}: ReportLocationPickerProps) {
	const selectedStation = useMemo(
		() =>
			selectedStationId
				? (stations.find(
						(station) => station.id === selectedStationId,
					) ?? null)
				: null,
		[selectedStationId, stations],
	);
	const existingCenter = useMemo(
		() =>
			deriveCenterFromLocations(
				stations.map((station) => ({
					lat: station.lat,
					lng: station.lng,
				})),
			),
		[stations],
	);
	const [viewportCenter, setViewportCenter] = useState(
		selectedPosition ?? existingCenter ?? MANILA_CENTER,
	);
	const [openInfoStationId, setOpenInfoStationId] = useState<string | null>(
		null,
	);
	const [isLocatingCurrentPosition, setIsLocatingCurrentPosition] =
		useState(false);
	const [isResolvingAddress, setIsResolvingAddress] = useState(false);
	const [addressError, setAddressError] = useState<string | null>(null);
	const [locationError, setLocationError] = useState<string | null>(null);
	const hasAttemptedAutoPinRef = useRef(false);
	const mapRef = useRef<google.maps.Map | null>(null);
	const geocoderRef = useRef<google.maps.Geocoder | null>(null);

	const activePosition = useMemo<CoordinatePair | null>(() => {
		if (selectedStation) {
			return {
				lat: selectedStation.lat,
				lng: selectedStation.lng,
			};
		}

		if (!selectedPosition) {
			return null;
		}

		return {
			lat: selectedPosition.lat,
			lng: selectedPosition.lng,
		};
	}, [
		selectedPosition?.lat,
		selectedPosition?.lng,
		selectedStation?.id,
		selectedStation?.lat,
		selectedStation?.lng,
	]);

	useEffect(() => {
		if (!selectedStationId) {
			setOpenInfoStationId(null);
			return;
		}

		if (!stations.some((station) => station.id === openInfoStationId)) {
			setOpenInfoStationId(null);
		}
	}, [openInfoStationId, selectedStationId, stations]);

	useEffect(() => {
		if (activePosition) {
			setViewportCenter((current) =>
				coordinatesMatch(current, activePosition)
					? current
					: activePosition,
			);
		}
	}, [activePosition]);

	useEffect(() => {
		if (activePosition) {
			return;
		}

		if (!navigator.geolocation) {
			setViewportCenter((current) => {
				const fallbackCenter = existingCenter ?? MANILA_CENTER;
				return coordinatesMatch(current, fallbackCenter)
					? current
					: fallbackCenter;
			});
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const currentLocation = {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				};
				setViewportCenter((current) =>
					coordinatesMatch(current, currentLocation)
						? current
						: currentLocation,
				);
			},
			() => {
				setViewportCenter((current) => {
					const fallbackCenter = existingCenter ?? MANILA_CENTER;
					return coordinatesMatch(current, fallbackCenter)
						? current
						: fallbackCenter;
				});
			},
		);
	}, [activePosition, existingCenter]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !activePosition) {
			return;
		}

		map.panTo(activePosition);
		map.setZoom(selectedStation ? 18 : 17);
	}, [activePosition, selectedStation]);

	const resolveAddress = useCallback(
		async (coordinates: CoordinatePair) => {
			const fallbackAddress = buildPinnedLocationLabel(coordinates);

			onSelectNewLocation({
				stationId: null,
				lat: coordinates.lat,
				lng: coordinates.lng,
				reportedAddress: fallbackAddress,
			});

			try {
				setIsResolvingAddress(true);
				setAddressError(null);
				setLocationError(null);

				if (
					typeof window === "undefined" ||
					typeof window.google === "undefined" ||
					typeof window.google.maps === "undefined" ||
					typeof window.google.maps.Geocoder !== "function"
				) {
					throw new Error("Google geocoder is unavailable");
				}

				const geocoder =
					geocoderRef.current ?? new window.google.maps.Geocoder();
				geocoderRef.current = geocoder;

				const response = await geocoder.geocode({
					location: coordinates,
				});
				const formattedAddress = response.results
					.find((result) => result.formatted_address?.trim())
					?.formatted_address?.trim();

				if (!formattedAddress) {
					throw new Error(
						"No address was returned for this location",
					);
				}

				onSelectNewLocation({
					stationId: null,
					lat: coordinates.lat,
					lng: coordinates.lng,
					reportedAddress: formattedAddress,
				});
			} catch {
				setAddressError(
					"Address lookup is unavailable right now. Using pinned coordinates instead.",
				);
			} finally {
				setIsResolvingAddress(false);
			}
		},
		[onSelectNewLocation],
	);

	const createStationMarkerIcon = useCallback(
		(status: StationStatus, isSelected: boolean): google.maps.Symbol => ({
			path: window.google.maps.SymbolPath.CIRCLE,
			scale: isSelected ? 11 : 8,
			fillColor: statusColors[status],
			fillOpacity: 1,
			strokeColor: isSelected ? "#111827" : "#ffffff",
			strokeWeight: isSelected ? 3 : 2,
		}),
		[],
	);

	const newLocationMarkerIcon = useMemo<google.maps.Symbol>(
		() => ({
			path: window.google.maps.SymbolPath.CIRCLE,
			scale: 10,
			fillColor: "#2563eb",
			fillOpacity: 1,
			strokeColor: "#ffffff",
			strokeWeight: 2,
		}),
		[],
	);

	const handlePinCurrentLocation = useCallback(() => {
		if (!navigator.geolocation) {
			setLocationError(
				"Your browser does not support location access. Pin the map manually instead.",
			);
			return;
		}

		setIsLocatingCurrentPosition(true);
		setLocationError(null);
		setAddressError(null);
		setOpenInfoStationId(null);

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const coordinates = {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				};

				setViewportCenter(coordinates);
				mapRef.current?.panTo(coordinates);
				mapRef.current?.setZoom(17);
				void resolveAddress(coordinates);
				setIsLocatingCurrentPosition(false);
			},
			(error) => {
				let message =
					"Could not access your current location. Pin the map manually instead.";

				if (error.code === error.PERMISSION_DENIED) {
					message =
						"Location access was denied. Pin the map manually or allow location access and try again.";
				} else if (error.code === error.TIMEOUT) {
					message =
						"Location lookup timed out. Please try again or pin the map manually.";
				}

				setLocationError(message);
				setIsLocatingCurrentPosition(false);
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 0,
			},
		);
	}, [resolveAddress]);

	useEffect(() => {
		if (!autoPinCurrentLocation) {
			hasAttemptedAutoPinRef.current = false;
			return;
		}

		if (hasAttemptedAutoPinRef.current) {
			return;
		}

		if (selectedStationId || selectedPosition || isLocatingCurrentPosition) {
			return;
		}

		hasAttemptedAutoPinRef.current = true;
		handlePinCurrentLocation();
	}, [
		autoPinCurrentLocation,
		handlePinCurrentLocation,
		isLocatingCurrentPosition,
		selectedPosition,
		selectedStationId,
	]);

	return (
		<div className="rounded-2xl border border-border bg-background p-4">
			<div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="flex items-start gap-2">
					<MapPin className="mt-0.5 h-4 w-4 text-accent" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Location Picker
						</p>
						<p className="text-xs text-muted-foreground">
							Tap a station marker to report an existing station,
							or click anywhere else to pin a new station
							location.
						</p>
					</div>
				</div>
				{selectedStation || selectedPosition ? (
					<button
						type="button"
						onClick={() => {
							setOpenInfoStationId(null);
							setLocationError(null);
							onClearSelection();
						}}
						className="rounded-full bg-surface-alt px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						Clear selection
					</button>
				) : (
					<button
						type="button"
						onClick={handlePinCurrentLocation}
						disabled={isLocatingCurrentPosition}
						className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs font-medium border border-primary text-primary transition-colors hover:text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isLocatingCurrentPosition ? (
							<>
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Locating...
							</>
						) : (
							"PIN MY CURRENT LOCATION"
						)}
					</button>
				)}
			</div>

			<div className="overflow-hidden rounded-xl border border-border">
				<GoogleMap
					mapContainerStyle={{
						...GOOGLE_MAPS_CONTAINER_STYLE,
						height: "460px",
					}}
					center={activePosition ?? viewportCenter}
					zoom={15}
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

						setOpenInfoStationId(null);
						setLocationError(null);
						void resolveAddress({
							lat: latLng.lat(),
							lng: latLng.lng(),
						});
					}}
					options={{
						fullscreenControl: true,
						mapTypeControl: true,
						streetViewControl: false,
						gestureHandling: "greedy",
					}}
				>
					{stations.map((station) => (
						<MarkerF
							key={station.id}
							position={{ lat: station.lat, lng: station.lng }}
							icon={createStationMarkerIcon(
								station.status,
								station.id === selectedStationId,
							)}
							onClick={() => {
								setAddressError(null);
								setLocationError(null);
								setOpenInfoStationId(station.id);
								onSelectExistingStation(station);
							}}
						>
							{openInfoStationId === station.id && (
								<InfoWindowF
									position={{
										lat: station.lat,
										lng: station.lng,
									}}
									onCloseClick={() =>
										setOpenInfoStationId(null)
									}
								>
									<StationMarkerInfoWindow
										station={station}
									/>
								</InfoWindowF>
							)}
						</MarkerF>
					))}

					{!selectedStationId && selectedPosition && (
						<MarkerF
							position={selectedPosition}
							draggable
							icon={newLocationMarkerIcon}
							onDragEnd={(event) => {
								const latLng = event.latLng;
								if (!latLng) {
									return;
								}

								void resolveAddress({
									lat: latLng.lat(),
									lng: latLng.lng(),
								});
							}}
						/>
					)}
				</GoogleMap>
			</div>

			<div className="mt-3 space-y-1 text-xs text-muted-foreground">
				{selectedStation ? (
					<>
						<p className="font-medium text-foreground">
							Reporting update for existing station:{" "}
							{selectedStation.name}
						</p>
						<p>{selectedStation.address}</p>
					</>
				) : selectedPosition ? (
					<>
						<p className="font-medium text-foreground">
							New station candidate at{" "}
							{formatCoordinate(selectedPosition.lat)},{" "}
							{formatCoordinate(selectedPosition.lng)}
						</p>
						<p>
							{selectedAddress ??
								buildPinnedLocationLabel(selectedPosition)}
						</p>
					</>
				) : (
					<p>
						Select an existing station or click the map to pin a new
						one.
					</p>
				)}

				{isResolvingAddress && (
					<p className="flex items-center gap-2">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Resolving address...
					</p>
				)}

				{addressError && <p className="text-warning">{addressError}</p>}
				{locationError && (
					<p className="text-warning">{locationError}</p>
				)}
			</div>
		</div>
	);
}

export function ReportLocationPicker(props: ReportLocationPickerProps) {
	if (!GOOGLE_MAPS_API_KEY) {
		return (
			<div className="rounded-2xl border border-border bg-card p-4">
				<div className="flex items-start gap-3">
					<MapPinned className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<p className="text-sm font-medium text-foreground">
							Google Maps is not configured
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Add `VITE_GOOGLE_MAPS_API_KEY` to use the report
							location picker.
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
				<div className="flex h-[360px] items-center justify-center rounded-2xl border border-border bg-card">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			}
		>
			<GoogleReportLocationPicker {...props} />
		</LoadScriptNext>
	);
}

import { useQuery } from "@tanstack/react-query";
import type { CoordinatePair } from "@/lib/google-maps";

export interface CurrentLocationResult {
	coordinates: CoordinatePair | null;
	error: string | null;
}

function getLocationErrorMessage(error: GeolocationPositionError) {
	switch (error.code) {
		case error.PERMISSION_DENIED:
			return "Location access was denied.";
		case error.POSITION_UNAVAILABLE:
			return "Current location is unavailable.";
		case error.TIMEOUT:
			return "Location request timed out.";
		default:
			return "Could not detect current location.";
	}
}

async function resolveCurrentLocation(): Promise<CurrentLocationResult> {
	if (typeof navigator === "undefined" || !navigator.geolocation) {
		return {
			coordinates: null,
			error: "Geolocation is not supported on this device.",
		};
	}

	return await new Promise<CurrentLocationResult>((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(position) => {
				resolve({
					coordinates: {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					},
					error: null,
				});
			},
			(error) => {
				resolve({
					coordinates: null,
					error: getLocationErrorMessage(error),
				});
			},
			{
				enableHighAccuracy: false,
				timeout: 10_000,
				maximumAge: 300_000,
			},
		);
	});
}

export function useCurrentLocation() {
	const query = useQuery({
		queryKey: ["current_location"],
		queryFn: resolveCurrentLocation,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return {
		...query,
		coordinates: query.data?.coordinates ?? null,
		locationError: query.data?.error ?? null,
	};
}

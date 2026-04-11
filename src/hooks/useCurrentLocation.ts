import { useMemo } from "react";
import type { CoordinatePair } from "@/lib/google-maps";
import { useUserLocation } from "@/hooks/useUserLocation";

export function useCurrentLocation() {
	const {
		latitude,
		longitude,
		loading,
		isRetrying,
		error,
		retryLocation,
	} = useUserLocation();
	const coordinates: CoordinatePair | null = useMemo(
		() =>
			latitude !== null && longitude !== null
				? {
						lat: latitude,
						lng: longitude,
					}
				: null,
		[latitude, longitude],
	);

	return {
		coordinates,
		isLoading: loading,
		isRetrying,
		locationError: error,
		retryLocation,
	};
}

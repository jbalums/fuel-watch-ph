import { useMemo } from "react";
import type { CoordinatePair } from "@/lib/google-maps";
import { useUserLocation } from "@/hooks/useUserLocation";

export function useCurrentLocation() {
	const { latitude, longitude, loading, error } = useUserLocation();
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
		locationError: error,
	};
}

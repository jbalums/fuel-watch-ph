import { useQuery } from "@tanstack/react-query";

const USER_LOCATION_QUERY_KEY = ["current_location"] as const;

interface UserLocationResult {
	latitude: number | null;
	longitude: number | null;
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

async function resolveUserLocation(): Promise<UserLocationResult> {
	if (typeof navigator === "undefined" || !navigator.geolocation) {
		return {
			latitude: null,
			longitude: null,
			error: "Geolocation is not supported on this device.",
		};
	}

	return await new Promise<UserLocationResult>((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(position) => {
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					error: null,
				});
			},
			(error) => {
				resolve({
					latitude: null,
					longitude: null,
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

export function useUserLocation() {
	const query = useQuery({
		queryKey: USER_LOCATION_QUERY_KEY,
		queryFn: resolveUserLocation,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return {
		latitude: query.data?.latitude ?? null,
		longitude: query.data?.longitude ?? null,
		loading: query.isLoading,
		isRetrying: query.isFetching && !query.isLoading,
		error: query.data?.error ?? null,
		retryLocation: () => query.refetch(),
	};
}

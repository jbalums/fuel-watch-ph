import type { Libraries } from "@react-google-maps/api";

export type CoordinateStrings = {
	lat: string;
	lng: string;
};

export type CoordinatePair = {
	lat: number;
	lng: number;
};

export type GoogleBasemapOption = "standard" | "satellite";

export const GOOGLE_MAPS_API_KEY =
	import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

export const GOOGLE_MAPS_SCRIPT_ID = "fuelwatch-google-maps";
export const GOOGLE_MAPS_LIBRARIES: Libraries = [];
export const GOOGLE_MAPS_CONTAINER_STYLE = {
	width: "100%",
	height: "100%",
} as const;

export const GOOGLE_MAPS_DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
	{ elementType: "geometry", stylers: [{ color: "#1d2433" }] },
	{ elementType: "labels.text.fill", stylers: [{ color: "#dbe7ff" }] },
	{ elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
	{
		featureType: "administrative",
		elementType: "geometry.stroke",
		stylers: [{ color: "#4b5563" }],
	},
	{
		featureType: "administrative.locality",
		elementType: "labels.text.fill",
		stylers: [{ color: "#f8fafc" }],
	},
	{
		featureType: "poi",
		elementType: "labels.text.fill",
		stylers: [{ color: "#b7c7dc" }],
	},
	{
		featureType: "poi.business",
		stylers: [{ visibility: "off" }],
	},
	{
		featureType: "poi.park",
		elementType: "geometry",
		stylers: [{ color: "#183524" }],
	},
	{
		featureType: "poi.park",
		elementType: "labels.text.fill",
		stylers: [{ color: "#86efac" }],
	},
	{
		featureType: "road",
		elementType: "geometry",
		stylers: [{ color: "#2f3b4f" }],
	},
	{
		featureType: "road",
		elementType: "geometry.stroke",
		stylers: [{ color: "#111827" }],
	},
	{
		featureType: "road",
		elementType: "labels.text.fill",
		stylers: [{ color: "#cbd5e1" }],
	},
	{
		featureType: "road.highway",
		elementType: "geometry",
		stylers: [{ color: "#4b5563" }],
	},
	{
		featureType: "road.highway",
		elementType: "geometry.stroke",
		stylers: [{ color: "#111827" }],
	},
	{
		featureType: "road.highway",
		elementType: "labels.text.fill",
		stylers: [{ color: "#fef3c7" }],
	},
	{
		featureType: "transit",
		elementType: "geometry",
		stylers: [{ color: "#263244" }],
	},
	{
		featureType: "water",
		elementType: "geometry",
		stylers: [{ color: "#0f253f" }],
	},
	{
		featureType: "water",
		elementType: "labels.text.fill",
		stylers: [{ color: "#93c5fd" }],
	},
];

export const MANILA_CENTER: CoordinatePair = {
	lat: 14.5995,
	lng: 120.9842,
};

export const GOOGLE_BASEMAP_CONFIG: Record<
	GoogleBasemapOption,
	{ label: string; mapTypeId: google.maps.MapTypeId }
> = {
	standard: {
		label: "Standard",
		mapTypeId: "roadmap",
	},
	satellite: {
		label: "Satellite",
		mapTypeId: "hybrid",
	},
};

export function parseCoordinateStrings(
	value: CoordinateStrings,
): CoordinatePair | null {
	const lat = Number.parseFloat(value.lat);
	const lng = Number.parseFloat(value.lng);

	if (Number.isNaN(lat) || Number.isNaN(lng)) {
		return null;
	}

	return { lat, lng };
}

export function formatCoordinate(value: number) {
	return value.toFixed(6);
}

export async function reverseGeocodeCoordinates(
	coordinates: CoordinatePair,
) {
	const geocoderAvailable =
		typeof window !== "undefined" &&
		typeof window.google !== "undefined" &&
		typeof window.google.maps !== "undefined" &&
		typeof window.google.maps.Geocoder === "function";

	if (geocoderAvailable) {
		const geocoder = new window.google.maps.Geocoder();
		const response = await geocoder.geocode({
			location: coordinates,
		});
		const formattedAddress = response.results
			.map((result) => result.formatted_address?.trim() ?? "")
			.find(Boolean);

		return formattedAddress ?? null;
	}

	if (!GOOGLE_MAPS_API_KEY) {
		return null;
	}

	const params = new URLSearchParams({
		latlng: `${coordinates.lat},${coordinates.lng}`,
		key: GOOGLE_MAPS_API_KEY,
	});

	const response = await fetch(
		`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
	);

	if (!response.ok) {
		throw new Error("Reverse geocoding request failed.");
	}

	const data = (await response.json()) as {
		status?: string;
		results?: Array<{
			formatted_address?: string;
		}>;
		error_message?: string;
	};

	if (data.status !== "OK" || !Array.isArray(data.results)) {
		if (data.status === "ZERO_RESULTS") {
			return null;
		}

		throw new Error(
			data.error_message || "Reverse geocoding did not return an address.",
		);
	}

	return (
		data.results
			.map((result) => result.formatted_address?.trim() ?? "")
			.find(Boolean) ?? null
	);
}

export function deriveCenterFromLocations(
	locations: CoordinatePair[],
): CoordinatePair | null {
	if (locations.length === 0) {
		return null;
	}

	const totals = locations.reduce(
		(accumulator, location) => ({
			lat: accumulator.lat + location.lat,
			lng: accumulator.lng + location.lng,
		}),
		{ lat: 0, lng: 0 },
	);

	return {
		lat: totals.lat / locations.length,
		lng: totals.lng / locations.length,
	};
}

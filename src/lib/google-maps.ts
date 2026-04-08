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
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places"];
export const GOOGLE_MAPS_CONTAINER_STYLE = {
	width: "100%",
	height: "100%",
} as const;

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

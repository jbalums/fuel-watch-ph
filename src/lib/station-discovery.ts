import type { GasStation } from "@/types/station";

export type GoogleDiscoveredStation = {
	placeId: string;
	name: string;
	address: string;
	lat: number;
	lng: number;
	addressComponents?: google.maps.places.AddressComponent[];
};

export type DuplicateMatch = {
	station: Pick<GasStation, "id" | "name" | "address" | "lat" | "lng" | "googlePlaceId">;
	kind: "exact_place_id" | "name_and_distance" | "distance_only";
	distanceMeters: number;
};

export const NAME_AND_DISTANCE_DUPLICATE_THRESHOLD_METERS = 150;
export const DISTANCE_ONLY_DUPLICATE_THRESHOLD_METERS = 30;

function normalizeText(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function toRadians(value: number) {
	return (value * Math.PI) / 180;
}

export function calculateDistanceMeters(
	start: { lat: number; lng: number },
	end: { lat: number; lng: number },
) {
	const earthRadiusMeters = 6_371_000;
	const deltaLat = toRadians(end.lat - start.lat);
	const deltaLng = toRadians(end.lng - start.lng);
	const startLat = toRadians(start.lat);
	const endLat = toRadians(end.lat);

	const haversine =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

	return (
		2 *
		earthRadiusMeters *
		Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
	);
}

export function dedupeDiscoveredStations(results: GoogleDiscoveredStation[]) {
	const deduped = new Map<string, GoogleDiscoveredStation>();

	for (const result of results) {
		deduped.set(result.placeId, result);
	}

	return Array.from(deduped.values());
}

export function mapPlaceResult(
	result: google.maps.places.Place,
): GoogleDiscoveredStation | null {
	const placeId = result.id?.trim();
	const name = result.displayName?.trim();
	const location = result.location;

	if (!placeId || !name || !location) {
		return null;
	}

	return {
		placeId,
		name,
		address: result.formattedAddress?.trim() || "Address unavailable",
		lat: location.lat(),
		lng: location.lng(),
		addressComponents: result.addressComponents,
	};
}

export async function searchGoogleFuelStationsInBounds(
	bounds: google.maps.LatLngBounds,
) {
	const { Place, SearchByTextRankPreference } =
		(await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
	const response = await Place.searchByText({
		textQuery: "gas station",
		fields: [
			"id",
			"displayName",
			"formattedAddress",
			"location",
			"viewport",
			"addressComponents",
		],
		locationRestriction: bounds,
		includedType: "gas_station",
		maxResultCount: 20,
		rankPreference: SearchByTextRankPreference.RELEVANCE,
		useStrictTypeFiltering: true,
	});

	return dedupeDiscoveredStations(
		(response.places ?? [])
			.map(mapPlaceResult)
			.filter((result): result is GoogleDiscoveredStation => Boolean(result)),
	);
}

export function getDuplicateMatch(
	result: GoogleDiscoveredStation,
	stations: Pick<
		GasStation,
		"id" | "name" | "address" | "lat" | "lng" | "googlePlaceId"
	>[],
): DuplicateMatch | null {
	const exactPlaceIdMatch =
		result.placeId &&
		stations.find(
			(station) =>
				station.googlePlaceId?.trim() &&
				station.googlePlaceId === result.placeId,
		);

	if (exactPlaceIdMatch) {
		return {
			station: exactPlaceIdMatch,
			kind: "exact_place_id",
			distanceMeters: calculateDistanceMeters(result, exactPlaceIdMatch),
		};
	}

	const normalizedResultName = normalizeText(result.name);
	const stationsByDistance = stations
		.map((station) => ({
			station,
			distanceMeters: calculateDistanceMeters(result, station),
			nameMatches:
				normalizedResultName.length > 0 &&
				normalizeText(station.name) === normalizedResultName,
		}))
		.sort((left, right) => left.distanceMeters - right.distanceMeters);

	const namedNearbyMatch = stationsByDistance.find(
		(candidate) =>
			candidate.nameMatches &&
			candidate.distanceMeters <=
				NAME_AND_DISTANCE_DUPLICATE_THRESHOLD_METERS,
	);

	if (namedNearbyMatch) {
		return {
			station: namedNearbyMatch.station,
			kind: "name_and_distance",
			distanceMeters: namedNearbyMatch.distanceMeters,
		};
	}

	const nearbyCoordinateMatch = stationsByDistance.find(
		(candidate) =>
			candidate.distanceMeters <=
			DISTANCE_ONLY_DUPLICATE_THRESHOLD_METERS,
	);

	if (nearbyCoordinateMatch) {
		return {
			station: nearbyCoordinateMatch.station,
			kind: "distance_only",
			distanceMeters: nearbyCoordinateMatch.distanceMeters,
		};
	}

	return null;
}

export function getDuplicateLabel(match: DuplicateMatch) {
	if (match.kind === "exact_place_id") {
		return "Already Added";
	}

	if (match.kind === "name_and_distance") {
		return "Likely Duplicate";
	}

	return "Nearby Existing Station";
}

export function getDuplicateMessage(match: DuplicateMatch) {
	if (match.kind === "exact_place_id") {
		return "This Google Maps station already exists in FuelWatch PH.";
	}

	if (match.kind === "name_and_distance") {
		return `A station with the same name already exists about ${Math.round(match.distanceMeters)}m away.`;
	}

	return `A local station already exists about ${Math.round(match.distanceMeters)}m from this Google result.`;
}

export function buildAddressSearchText(result: GoogleDiscoveredStation) {
	const componentText = (result.addressComponents ?? [])
		.map((component) => component.longText?.trim())
		.filter(Boolean)
		.join(", ");

	return [result.address, componentText].filter(Boolean).join(", ");
}

export function formatLatLng(value: number) {
	return value.toFixed(6);
}

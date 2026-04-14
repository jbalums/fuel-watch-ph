import type { GasStation } from "@/types/station";
import {
	initialStationForm,
	type StationFormState,
} from "@/components/admin/admin-shared";
import {
	searchOverpassFuelStationsInBounds,
	type OverpassFuelStationResult,
} from "@/lib/overpass-fuel-discovery";

export type DiscoveredStation = OverpassFuelStationResult & {
	googlePlaceId?: string | null;
};

export type GoogleDiscoveredStation = DiscoveredStation;

export type DuplicateMatch = {
	station: Pick<
		GasStation,
		"id" | "name" | "address" | "lat" | "lng" | "googlePlaceId"
	>;
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

function containsWholePhrase(haystack: string, needle: string) {
	if (!haystack || !needle) {
		return false;
	}

	const pattern = new RegExp(
		`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
		"i",
	);

	return pattern.test(haystack);
}

export const AUTO_CREATE_SUPPORTED_DISCOVERY_BRANDS = [
	"Shell",
	"Petron",
	"Caltex",
	"Unioil",
	"PTT",
	"Seaoil",
	"Total",
	"Phoenix",
	"ECOOIL",
	"Jetti",
] as const;

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

export function dedupeDiscoveredStations(results: DiscoveredStation[]) {
	const deduped = new Map<string, DiscoveredStation>();

	for (const result of results) {
		deduped.set(result.externalId, result);
	}

	return Array.from(deduped.values());
}

export async function searchDiscoveredFuelStationsInBounds(
	bounds: google.maps.LatLngBounds,
) {
	return dedupeDiscoveredStations(
		await searchOverpassFuelStationsInBounds(bounds),
	);
}

export function getDuplicateMatch(
	result: DiscoveredStation,
	stations: Pick<
		GasStation,
		"id" | "name" | "address" | "lat" | "lng" | "googlePlaceId"
	>[],
): DuplicateMatch | null {
	const exactPlaceIdMatch =
		result.googlePlaceId?.trim() &&
		stations.find(
			(station) =>
				station.googlePlaceId?.trim() &&
				station.googlePlaceId === result.googlePlaceId,
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
			candidate.distanceMeters <= DISTANCE_ONLY_DUPLICATE_THRESHOLD_METERS,
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
		return "This discovered station already exists in FuelWatch PH.";
	}

	if (match.kind === "name_and_distance") {
		return `A station with the same name already exists about ${Math.round(match.distanceMeters)}m away.`;
	}

	return `A local station already exists about ${Math.round(match.distanceMeters)}m from this discovered station.`;
}

export function buildAddressSearchText(result: DiscoveredStation) {
	const tagText = Object.values(result.tags ?? {})
		.map((value) => value.trim())
		.filter(Boolean)
		.join(", ");

	return [result.address, result.brand, tagText].filter(Boolean).join(", ");
}

export function formatLatLng(value: number) {
	return value.toFixed(6);
}

export function getDiscoveredStationAutoCreateBrand(name: string) {
	const normalizedName = normalizeText(name);
	if (!normalizedName) {
		return null;
	}

	return (
		AUTO_CREATE_SUPPORTED_DISCOVERY_BRANDS.find((brand) =>
			containsWholePhrase(normalizedName, normalizeText(brand)),
		) ?? null
	);
}

export function buildDiscoveredStationForm(
	result: DiscoveredStation,
	scope?: {
		provinceCode?: string | null;
		cityMunicipalityCode?: string | null;
	},
): StationFormState {
	return {
		...initialStationForm,
		name: result.name,
		address: result.address,
		lat: formatLatLng(result.lat),
		lng: formatLatLng(result.lng),
		googlePlaceId: result.googlePlaceId ?? "",
		provinceCode: scope?.provinceCode ?? "",
		cityMunicipalityCode: scope?.cityMunicipalityCode ?? "",
	};
}

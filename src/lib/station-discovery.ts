import type { GasStation } from "@/types/station";
import {
	initialStationForm,
	type StationFormState,
} from "@/components/admin/admin-shared";
import {
	searchOverpassFuelStationsInBounds,
	type OverpassFuelStationResult,
} from "@/lib/overpass-fuel-discovery";
import { reverseGeocodeCoordinatesWithNominatim } from "@/lib/nominatim";

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
const DISCOVERED_STATION_CACHE_STORAGE_KEY =
	"discovered-stations-by-area-v1";
const DISCOVERED_STATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DISCOVERED_STATION_CACHE_GRID_STEP = 0.02;
const discoveredStationAddressCache = new Map<string, string>();
const discoveredStationAddressRequests = new Map<string, Promise<string>>();

type DiscoveredStationCacheEntry = {
	key: string;
	createdAt: number;
	stations: DiscoveredStation[];
};

type DiscoveredStationCacheStore = Record<string, DiscoveredStationCacheEntry>;

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

function getRoundedGridValue(value: number) {
	return (
		Math.round(value / DISCOVERED_STATION_CACHE_GRID_STEP) *
		DISCOVERED_STATION_CACHE_GRID_STEP
	).toFixed(2);
}

function buildDiscoveredStationBoundsCacheKey(
	bounds: google.maps.LatLngBounds,
) {
	const northEast = bounds.getNorthEast();
	const southWest = bounds.getSouthWest();

	return [
		"n",
		getRoundedGridValue(northEast.lat()),
		"e",
		getRoundedGridValue(northEast.lng()),
		"s",
		getRoundedGridValue(southWest.lat()),
		"w",
		getRoundedGridValue(southWest.lng()),
	].join(":");
}

function isDiscoveredStationRecord(value: unknown): value is DiscoveredStation {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<DiscoveredStation>;
	return (
		typeof candidate.externalId === "string" &&
		candidate.source === "osm_overpass" &&
		typeof candidate.name === "string" &&
		(typeof candidate.brand === "string" || candidate.brand === null) &&
		typeof candidate.address === "string" &&
		typeof candidate.lat === "number" &&
		Number.isFinite(candidate.lat) &&
		typeof candidate.lng === "number" &&
		Number.isFinite(candidate.lng) &&
		Boolean(candidate.tags && typeof candidate.tags === "object")
	);
}

function isDiscoveredStationCacheEntry(
	value: unknown,
): value is DiscoveredStationCacheEntry {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<DiscoveredStationCacheEntry>;
	return (
		typeof candidate.key === "string" &&
		typeof candidate.createdAt === "number" &&
		Number.isFinite(candidate.createdAt) &&
		Array.isArray(candidate.stations) &&
		candidate.stations.every(isDiscoveredStationRecord)
	);
}

function readDiscoveredStationCacheStore() {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const rawValue = window.localStorage.getItem(
			DISCOVERED_STATION_CACHE_STORAGE_KEY,
		);

		if (!rawValue) {
			return {} as DiscoveredStationCacheStore;
		}

		const parsed = JSON.parse(rawValue) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			window.localStorage.removeItem(DISCOVERED_STATION_CACHE_STORAGE_KEY);
			return {} as DiscoveredStationCacheStore;
		}

		const entries = Object.entries(parsed as Record<string, unknown>);
		const validEntries = entries.filter(([, entry]) =>
			isDiscoveredStationCacheEntry(entry),
		);

		if (validEntries.length !== entries.length) {
			const sanitizedStore = Object.fromEntries(validEntries);
			window.localStorage.setItem(
				DISCOVERED_STATION_CACHE_STORAGE_KEY,
				JSON.stringify(sanitizedStore),
			);
			return sanitizedStore as DiscoveredStationCacheStore;
		}

		return parsed as DiscoveredStationCacheStore;
	} catch {
		return null;
	}
}

function writeDiscoveredStationCacheStore(
	store: DiscoveredStationCacheStore,
) {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(
			DISCOVERED_STATION_CACHE_STORAGE_KEY,
			JSON.stringify(store),
		);
	} catch {
		// Ignore cache write failures and continue with live discovery.
	}
}

function getCachedDiscoveredStationsForBounds(
	bounds: google.maps.LatLngBounds,
) {
	const cacheStore = readDiscoveredStationCacheStore();
	if (!cacheStore) {
		return null;
	}

	const cacheKey = buildDiscoveredStationBoundsCacheKey(bounds);
	const cacheEntry = cacheStore[cacheKey];
	if (!cacheEntry) {
		return null;
	}

	if (Date.now() - cacheEntry.createdAt > DISCOVERED_STATION_CACHE_TTL_MS) {
		delete cacheStore[cacheKey];
		writeDiscoveredStationCacheStore(cacheStore);
		return null;
	}

	return dedupeDiscoveredStations(cacheEntry.stations);
}

function cacheDiscoveredStationsForBounds(
	bounds: google.maps.LatLngBounds,
	stations: DiscoveredStation[],
) {
	const cacheStore = readDiscoveredStationCacheStore();
	if (!cacheStore) {
		return;
	}

	const cacheKey = buildDiscoveredStationBoundsCacheKey(bounds);
	cacheStore[cacheKey] = {
		key: cacheKey,
		createdAt: Date.now(),
		stations: dedupeDiscoveredStations(stations),
	};
	writeDiscoveredStationCacheStore(cacheStore);
}

export async function searchDiscoveredFuelStationsInBounds(
	bounds: google.maps.LatLngBounds,
) {
	const cachedStations = getCachedDiscoveredStationsForBounds(bounds);
	if (cachedStations) {
		return cachedStations;
	}

	const liveResults = dedupeDiscoveredStations(
		await searchOverpassFuelStationsInBounds(bounds),
	);
	cacheDiscoveredStationsForBounds(bounds, liveResults);

	return liveResults;
}

export function getResolvedDiscoveredStationAddress(externalId: string) {
	return discoveredStationAddressCache.get(externalId) ?? null;
}

export async function resolveDiscoveredStationAddress(
	result: DiscoveredStation,
) {
	const cachedAddress = getResolvedDiscoveredStationAddress(result.externalId);
	if (cachedAddress) {
		return {
			...result,
			address: cachedAddress,
		};
	}

	const inFlightRequest = discoveredStationAddressRequests.get(
		result.externalId,
	);

	if (inFlightRequest) {
		const address = await inFlightRequest;
		return {
			...result,
			address,
		};
	}

	const nextRequest = reverseGeocodeCoordinatesWithNominatim({
		lat: result.lat,
		lng: result.lng,
	})
		.then(({ addressText }) => {
			const normalizedAddress = addressText.trim() || result.address;
			discoveredStationAddressCache.set(
				result.externalId,
				normalizedAddress,
			);
			return normalizedAddress;
		})
		.finally(() => {
			discoveredStationAddressRequests.delete(result.externalId);
		});

	discoveredStationAddressRequests.set(result.externalId, nextRequest);

	const address = await nextRequest;
	return {
		...result,
		address,
	};
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

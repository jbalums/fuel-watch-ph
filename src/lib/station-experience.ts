import type {
	GasStation,
	StationExperienceIdentity,
	StationExperienceSentiment,
} from "@/types/station";
import type { DiscoveredStation } from "@/lib/station-discovery";

export const STATION_EXPERIENCE_PUBLIC_AUTHOR_LABEL =
	"Posted by a community member";

export function buildStationExperienceIdentityFromStation(
	station: Pick<
		GasStation,
		| "id"
		| "name"
		| "address"
		| "lat"
		| "lng"
		| "provinceCode"
		| "cityMunicipalityCode"
	>,
): StationExperienceIdentity {
	return {
		stationId: station.id,
		source: null,
		externalId: null,
		stationName: station.name,
		stationAddress: station.address,
		lat: station.lat,
		lng: station.lng,
		provinceCode: station.provinceCode,
		cityMunicipalityCode: station.cityMunicipalityCode,
	};
}

export function buildStationExperienceIdentityFromDiscoveredStation(
	station: Pick<DiscoveredStation, "externalId" | "source" | "name" | "address" | "lat" | "lng">,
	scope?: {
		provinceCode?: string | null;
		cityMunicipalityCode?: string | null;
	},
): StationExperienceIdentity {
	return {
		stationId: null,
		source: station.source ?? "osm_overpass",
		externalId: station.externalId,
		stationName: station.name,
		stationAddress: station.address,
		lat: station.lat,
		lng: station.lng,
		provinceCode: scope?.provinceCode ?? null,
		cityMunicipalityCode: scope?.cityMunicipalityCode ?? null,
	};
}

export function buildStationExperienceSearch(identity: StationExperienceIdentity) {
	const params = new URLSearchParams();

	if (identity.stationId) {
		params.set("stationId", identity.stationId);
	}
	if (identity.source) {
		params.set("source", identity.source);
	}
	if (identity.externalId) {
		params.set("externalId", identity.externalId);
	}
	if (identity.stationName) {
		params.set("name", identity.stationName);
	}
	if (identity.stationAddress) {
		params.set("address", identity.stationAddress);
	}
	if (typeof identity.lat === "number" && Number.isFinite(identity.lat)) {
		params.set("lat", identity.lat.toString());
	}
	if (typeof identity.lng === "number" && Number.isFinite(identity.lng)) {
		params.set("lng", identity.lng.toString());
	}
	if (identity.provinceCode) {
		params.set("provinceCode", identity.provinceCode);
	}
	if (identity.cityMunicipalityCode) {
		params.set("cityMunicipalityCode", identity.cityMunicipalityCode);
	}

	const search = params.toString();
	return search ? `?${search}` : "";
}

export function parseStationExperienceIdentityFromSearch(
	searchParams: URLSearchParams,
): StationExperienceIdentity | null {
	const stationId = searchParams.get("stationId");
	const source = searchParams.get("source");
	const externalId = searchParams.get("externalId");
	const stationName = searchParams.get("name") ?? "";
	const stationAddress = searchParams.get("address") ?? "";
	const lat = Number.parseFloat(searchParams.get("lat") ?? "");
	const lng = Number.parseFloat(searchParams.get("lng") ?? "");
	const provinceCode = searchParams.get("provinceCode");
	const cityMunicipalityCode = searchParams.get("cityMunicipalityCode");

	if (!stationId && !(source && externalId)) {
		return null;
	}

	return {
		stationId: stationId ?? null,
		source: source ?? null,
		externalId: externalId ?? null,
		stationName,
		stationAddress,
		lat: Number.isFinite(lat) ? lat : null,
		lng: Number.isFinite(lng) ? lng : null,
		provinceCode,
		cityMunicipalityCode,
	};
}

export function hasStationExperienceIdentity(identity: StationExperienceIdentity | null | undefined) {
	return Boolean(identity?.stationId || (identity?.source && identity?.externalId));
}

export function getStationExperienceSentimentLabel(
	sentiment: StationExperienceSentiment,
) {
	return sentiment === "good" ? "Good experience" : "Bad experience";
}

export function getStationExperienceSentimentClassName(
	sentiment: StationExperienceSentiment,
) {
	return sentiment === "good"
		? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
		: "bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

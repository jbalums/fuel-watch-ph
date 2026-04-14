type OverpassElement = {
	type: "node" | "way" | "relation";
	id: number;
	lat?: number;
	lon?: number;
	center?: {
		lat: number;
		lon: number;
	};
	tags?: Record<string, string>;
};

type OverpassResponse = {
	elements?: OverpassElement[];
};

export type OverpassFuelStationResult = {
	externalId: string;
	source: "osm_overpass";
	name: string;
	brand: string | null;
	address: string;
	lat: number;
	lng: number;
	tags: Record<string, string>;
};

const OVERPASS_STATUS_URL = "https://overpass-api.de/api/status";
const OVERPASS_INTERPRETER_URL = "https://overpass-api.de/api/interpreter";

function buildOverpassBoundsQuery(bounds: google.maps.LatLngBounds) {
	const northEast = bounds.getNorthEast();
	const southWest = bounds.getSouthWest();

	return `
		[out:json][timeout:60];
		(
		  node["amenity"="fuel"](${southWest.lat()},${southWest.lng()},${northEast.lat()},${northEast.lng()});
		  way["amenity"="fuel"](${southWest.lat()},${southWest.lng()},${northEast.lat()},${northEast.lng()});
		  relation["amenity"="fuel"](${southWest.lat()},${southWest.lng()},${northEast.lat()},${northEast.lng()});
		);
		out center tags;
	`;
}

function resolveElementCoordinates(element: OverpassElement) {
	if (typeof element.lat === "number" && typeof element.lon === "number") {
		return {
			lat: element.lat,
			lng: element.lon,
		};
	}

	if (
		typeof element.center?.lat === "number" &&
		typeof element.center?.lon === "number"
	) {
		return {
			lat: element.center.lat,
			lng: element.center.lon,
		};
	}

	return null;
}

function buildAddressFromTags(tags: Record<string, string>) {
	const explicitAddress = [
		tags["addr:housenumber"],
		tags["addr:street"],
		tags["addr:subdistrict"],
		tags["addr:district"],
		tags["addr:city"],
		tags["addr:province"],
	]
		.filter(Boolean)
		.join(", ")
		.trim();

	if (explicitAddress) {
		return explicitAddress;
	}

	const localityAddress = [
		tags["addr:street"],
		tags["addr:city"] || tags["city"],
		tags["addr:province"] || tags["province"] || tags["is_in:state"],
	]
		.filter(Boolean)
		.join(", ")
		.trim();

	if (localityAddress) {
		return localityAddress;
	}

	const brandLocality = [
		tags.brand,
		tags["addr:city"] || tags["city"] || tags["is_in:city"],
		tags["addr:province"] || tags["province"] || tags["is_in:state"],
	]
		.filter(Boolean)
		.join(", ")
		.trim();

	return brandLocality || "Address unavailable";
}

function mapOverpassFuelStation(
	element: OverpassElement,
): OverpassFuelStationResult | null {
	const tags = element.tags ?? {};
	if (tags.amenity !== "fuel") {
		return null;
	}

	const coordinates = resolveElementCoordinates(element);
	if (!coordinates) {
		return null;
	}

	const name =
		tags.name?.trim() ||
		tags.brand?.trim() ||
		`${tags.operator?.trim() || "Unnamed"} Fuel Station`;

	return {
		externalId: `${element.type}:${element.id}`,
		source: "osm_overpass",
		name,
		brand: tags.brand?.trim() || null,
		address: buildAddressFromTags(tags),
		lat: coordinates.lat,
		lng: coordinates.lng,
		tags,
	};
}

function parseAvailableSlots(statusText: string) {
	const normalizedText = statusText.trim();

	const explicitAvailableSlotsMatch = normalizedText.match(
		/(\d+)\s+slots?\s+available\s+now/i,
	);
	if (explicitAvailableSlotsMatch) {
		return Number.parseInt(explicitAvailableSlotsMatch[1] ?? "0", 10);
	}

	if (/slot available after:/i.test(normalizedText)) {
		return 0;
	}

	return null;
}

async function ensureOverpassSlotAvailability() {
	const statusResponse = await fetch(OVERPASS_STATUS_URL);
	if (!statusResponse.ok) {
		return;
	}

	const statusText = await statusResponse.text();
	const availableSlots = parseAvailableSlots(statusText);

	if (availableSlots === 0) {
		throw new Error(
			"OpenStreetMap discovery is busy right now. Please try again in a moment.",
		);
	}
}

export async function searchOverpassFuelStationsInBounds(
	bounds: google.maps.LatLngBounds,
) {
	await ensureOverpassSlotAvailability();

	const query = buildOverpassBoundsQuery(bounds);
	const response = await fetch(OVERPASS_INTERPRETER_URL, {
		method: "POST",
		body: query,
	});

	if (!response.ok) {
		throw new Error(
			`OpenStreetMap discovery failed with status ${response.status}.`,
		);
	}

	const data = (await response.json()) as OverpassResponse;

	return (data.elements ?? [])
		.map(mapOverpassFuelStation)
		.filter((result): result is OverpassFuelStationResult =>
			Boolean(result),
		);
}

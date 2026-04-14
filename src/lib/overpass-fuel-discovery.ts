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

function buildOverpassBoundsQuery(bounds: google.maps.LatLngBounds) {
	const northEast = bounds.getNorthEast();
	const southWest = bounds.getSouthWest();

	return `
		[out:json][timeout:25];
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

export async function searchOverpassFuelStationsInBounds(
	bounds: google.maps.LatLngBounds,
) {
	const query = buildOverpassBoundsQuery(bounds);
	const response = await fetch("https://overpass-api.de/api/interpreter", {
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
		.filter(
			(result): result is OverpassFuelStationResult => Boolean(result),
		);
}

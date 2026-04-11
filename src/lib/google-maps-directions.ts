export interface GoogleMapsDirectionsDestination {
	lat: number | null | undefined;
	lng: number | null | undefined;
	placeId?: string | null;
	originLat?: number | null;
	originLng?: number | null;
}

function isValidLatitude(value: number | null | undefined) {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= -90 &&
		value <= 90
	);
}

function isValidLongitude(value: number | null | undefined) {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= -180 &&
		value <= 180
	);
}

export function hasValidDirectionsDestination(
	destination: GoogleMapsDirectionsDestination,
) {
	return (
		isValidLatitude(destination.lat) && isValidLongitude(destination.lng)
	);
}

export function buildGoogleMapsDirectionsUrl(
	destination: GoogleMapsDirectionsDestination,
) {
	if (!hasValidDirectionsDestination(destination)) {
		return null;
	}

	const params = new URLSearchParams({
		api: "1",
		destination: `${destination.lat},${destination.lng}`,
		travelmode: "driving",
	});
	const normalizedPlaceId = destination.placeId?.trim();
	const hasValidOrigin =
		isValidLatitude(destination.originLat) &&
		isValidLongitude(destination.originLng);

	if (hasValidOrigin) {
		params.set("origin", `${destination.originLat},${destination.originLng}`);
	}

	if (normalizedPlaceId) {
		params.set("destination_place_id", normalizedPlaceId);
	}

	return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openGoogleMapsDirections(
	destination: GoogleMapsDirectionsDestination,
) {
	const url = buildGoogleMapsDirectionsUrl(destination);

	if (!url || typeof window === "undefined") {
		return false;
	}

	window.open(url, "_blank", "noopener,noreferrer");
	return true;
}

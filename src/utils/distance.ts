const EARTH_RADIUS_KM = 6_371;

function toRadians(value: number) {
	return (value * Math.PI) / 180;
}

function isValidCoordinate(value: number) {
	return Number.isFinite(value);
}

export function calculateDistanceKm(
	userLat: number,
	userLng: number,
	stationLat: number,
	stationLng: number,
) {
	if (
		!isValidCoordinate(userLat) ||
		!isValidCoordinate(userLng) ||
		!isValidCoordinate(stationLat) ||
		!isValidCoordinate(stationLng)
	) {
		return Number.NaN;
	}

	const latDelta = toRadians(stationLat - userLat);
	const lngDelta = toRadians(stationLng - userLng);
	const fromLat = toRadians(userLat);
	const toLat = toRadians(stationLat);

	const haversine =
		Math.sin(latDelta / 2) ** 2 +
		Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

	const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
	const distance = EARTH_RADIUS_KM * arc;

	return Math.round(distance * 10) / 10;
}

export function sortStationsByDistance<T extends { lat: number; lng: number }>(
	stations: T[],
	userLat: number,
	userLng: number,
) {
	return [...stations].sort((a, b) => {
		const distanceA = calculateDistanceKm(userLat, userLng, a.lat, a.lng);
		const distanceB = calculateDistanceKm(userLat, userLng, b.lat, b.lng);

		if (Number.isNaN(distanceA) && Number.isNaN(distanceB)) {
			return 0;
		}

		if (Number.isNaN(distanceA)) {
			return 1;
		}

		if (Number.isNaN(distanceB)) {
			return -1;
		}

		return distanceA - distanceB;
	});
}

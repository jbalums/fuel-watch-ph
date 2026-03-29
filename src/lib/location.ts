type CoordinateLike = {
	lat: number;
	lng: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
	return (value * Math.PI) / 180;
}

export function getDistanceBetweenCoordinates(
	from: CoordinateLike,
	to: CoordinateLike,
) {
	const latDelta = toRadians(to.lat - from.lat);
	const lngDelta = toRadians(to.lng - from.lng);
	const fromLat = toRadians(from.lat);
	const toLat = toRadians(to.lat);

	const haversine =
		Math.sin(latDelta / 2) ** 2 +
		Math.cos(fromLat) *
			Math.cos(toLat) *
			Math.sin(lngDelta / 2) ** 2;

	const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
	return EARTH_RADIUS_METERS * arc;
}

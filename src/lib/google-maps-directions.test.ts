import { describe, expect, it } from "vitest";
import {
	buildGoogleMapsDirectionsUrl,
	hasValidDirectionsDestination,
} from "@/lib/google-maps-directions";

describe("google maps directions helper", () => {
	it("builds a driving directions URL from coordinates", () => {
		expect(
			buildGoogleMapsDirectionsUrl({
				lat: 9.647,
				lng: 123.855,
			}),
		).toBe(
			"https://www.google.com/maps/dir/?api=1&destination=9.647%2C123.855&travelmode=driving",
		);
	});

	it("includes destination_place_id when available", () => {
		expect(
			buildGoogleMapsDirectionsUrl({
				lat: 9.647,
				lng: 123.855,
				placeId: "ChIJd8BlQ2BZwzMRQh0Qn3W3P8U",
			}),
		).toBe(
			"https://www.google.com/maps/dir/?api=1&destination=9.647%2C123.855&travelmode=driving&destination_place_id=ChIJd8BlQ2BZwzMRQh0Qn3W3P8U",
		);
	});

	it("returns null for invalid destination coordinates", () => {
		expect(
			buildGoogleMapsDirectionsUrl({
				lat: Number.NaN,
				lng: 123.855,
			}),
		).toBeNull();
		expect(
			hasValidDirectionsDestination({
				lat: 95,
				lng: 123.855,
			}),
		).toBe(false);
	});
});

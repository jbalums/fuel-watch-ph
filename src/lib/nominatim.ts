import type { CoordinatePair } from "@/lib/google-maps";

type NominatimReverseResponse = {
	display_name?: string;
	address?: {
		state?: string;
		region?: string;
		county?: string;
		city?: string;
		municipality?: string;
		town?: string;
		village?: string;
	};
	error?: string;
};

export async function reverseGeocodeCoordinatesWithNominatim(
	coordinates: CoordinatePair,
) {
	const params = new URLSearchParams({
		format: "jsonv2",
		lat: String(coordinates.lat),
		lon: String(coordinates.lng),
	});

	const response = await fetch(
		`https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
		{
			headers: {
				"Accept-Language": "en",
			},
		},
	);

	if (!response.ok) {
		throw new Error("Nominatim reverse geocoding request failed.");
	}

	const data = (await response.json()) as NominatimReverseResponse;
	if (data.error) {
		throw new Error(data.error);
	}

	const addressParts = [
		data.address?.village,
		data.address?.town,
		data.address?.municipality,
		data.address?.city,
		data.address?.county,
		data.address?.state,
		data.address?.region,
		data.display_name,
	]
		.map((value) => value?.trim() ?? "")
		.filter(Boolean);

	return {
		addressText: addressParts.join(", "),
		raw: data,
	};
}

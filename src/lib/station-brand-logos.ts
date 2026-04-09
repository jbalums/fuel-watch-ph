import defaultStationPin from "@/assets/images/map-pin-icon.png";
import { createEmptyFuelPriceMap, fuelTypes } from "@/lib/fuel-prices";
import type { FuelPriceMap } from "@/lib/fuel-prices";
import type { GasStation, StationBrandLogo } from "@/types/station";

type StationLogoResolutionInput = {
	name: string;
	stationBrandLogoId?: string | null;
};

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

export function resolveStationBrandLogo(
	station: StationLogoResolutionInput,
	brandLogos: StationBrandLogo[],
) {
	const activeBrandLogos = brandLogos.filter(
		(brandLogo) => brandLogo.isActive,
	);

	if (station.stationBrandLogoId) {
		const overrideBrandLogo =
			activeBrandLogos.find(
				(brandLogo) => brandLogo.id === station.stationBrandLogoId,
			) ?? null;

		if (overrideBrandLogo) {
			return overrideBrandLogo;
		}
	}

	const normalizedStationName = normalizeText(station.name);
	if (!normalizedStationName) {
		return null;
	}

	return (
		activeBrandLogos.find((brandLogo) => {
			const normalizedKeywords = [
				brandLogo.brandName,
				...brandLogo.matchKeywords,
			]
				.map(normalizeText)
				.filter(Boolean);

			return normalizedKeywords.some((keyword) =>
				containsWholePhrase(normalizedStationName, keyword),
			);
		}) ?? null
	);
}

export type StationBrandAverage = {
	brandName: string;
	sampleCount: number;
	averagePrices: FuelPriceMap;
};

export function buildStationBrandAverage(
	station: StationLogoResolutionInput,
	stations: Pick<GasStation, "name" | "stationBrandLogoId" | "prices">[],
	brandLogos: StationBrandLogo[],
): StationBrandAverage | null {
	const matchedBrandLogo = resolveStationBrandLogo(station, brandLogos);
	if (!matchedBrandLogo) {
		return null;
	}

	const matchingStations = stations.filter((candidate) => {
		const candidateBrandLogo = resolveStationBrandLogo(
			{
				name: candidate.name,
				stationBrandLogoId: candidate.stationBrandLogoId,
			},
			brandLogos,
		);

		return candidateBrandLogo?.id === matchedBrandLogo.id;
	});

	if (matchingStations.length === 0) {
		return {
			brandName: matchedBrandLogo.brandName,
			sampleCount: 0,
			averagePrices: createEmptyFuelPriceMap(),
		};
	}

	const totals = createEmptyFuelPriceMap();
	const counts = fuelTypes.reduce<Record<typeof fuelTypes[number], number>>(
		(accumulator, fuelType) => {
			accumulator[fuelType] = 0;
			return accumulator;
		},
		{} as Record<typeof fuelTypes[number], number>,
	);

	for (const candidate of matchingStations) {
		for (const fuelType of fuelTypes) {
			const price = candidate.prices[fuelType];
			if (
				typeof price !== "number" ||
				!Number.isFinite(price) ||
				price <= 0
			) {
				continue;
			}

			totals[fuelType] = (totals[fuelType] ?? 0) + price;
			counts[fuelType] += 1;
		}
	}

	const averagePrices = createEmptyFuelPriceMap();
	for (const fuelType of fuelTypes) {
		if (counts[fuelType] === 0) {
			averagePrices[fuelType] = null;
			continue;
		}

		averagePrices[fuelType] = Number(
			((totals[fuelType] ?? 0) / counts[fuelType]).toFixed(2),
		);
	}

	return {
		brandName: matchedBrandLogo.brandName,
		sampleCount: matchingStations.length,
		averagePrices,
	};
}

export function buildDefaultStationMarkerIcon(googleMaps: typeof google.maps) {
	return {
		url: defaultStationPin,
		scaledSize: new googleMaps.Size(45, 40),
		anchor: new googleMaps.Point(22.5, 35),
	} satisfies google.maps.Icon;
}

export function buildBrandLogoMarkerIcon(
	googleMaps: typeof google.maps,
	logoUrl: string,
	options?: { isSelected?: boolean },
) {
	const size = options?.isSelected ? 44 : 38;

	return {
		url: logoUrl,
		scaledSize: new googleMaps.Size(45, 40),
		anchor: new googleMaps.Point(22.5, 35),
	} satisfies google.maps.Icon;
}

export function buildResolvedStationMarkerIcon(
	googleMaps: typeof google.maps,
	station: StationLogoResolutionInput,
	brandLogos: StationBrandLogo[],
	options?: { isSelected?: boolean },
) {
	const matchedBrandLogo = resolveStationBrandLogo(station, brandLogos);

	if (!matchedBrandLogo?.logoUrl) {
		return buildDefaultStationMarkerIcon(googleMaps);
	}

	return buildBrandLogoMarkerIcon(
		googleMaps,
		matchedBrandLogo.logoUrl,
		options,
	);
}

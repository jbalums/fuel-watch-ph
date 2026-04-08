import defaultStationPin from "@/assets/images/map-pin-icon.png";
import type { StationBrandLogo } from "@/types/station";

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

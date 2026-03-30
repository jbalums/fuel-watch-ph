import type {
	GeoCityMunicipality,
	GeoProvince,
} from "@/hooks/useGeoReferences";

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

export function detectGeoScopeFromAddress({
	address,
	provinces,
	cities,
}: {
	address: string;
	provinces: GeoProvince[];
	cities: GeoCityMunicipality[];
}) {
	const normalizedAddress = normalizeText(address);

	if (!normalizedAddress) {
		return null;
	}

	const sortedCities = [...cities].sort((left, right) => {
		return right.name.length - left.name.length;
	});
	const sortedProvinces = [...provinces].sort((left, right) => {
		return right.name.length - left.name.length;
	});

	const matchedCity =
		sortedCities.find((city) =>
			containsWholePhrase(normalizedAddress, normalizeText(city.name)),
		) ?? null;

	const matchedProvince =
		sortedProvinces.find((province) =>
			containsWholePhrase(normalizedAddress, normalizeText(province.name)),
		) ?? null;

	if (matchedCity) {
		return {
			provinceCode: matchedCity.province_code,
			cityMunicipalityCode: matchedCity.code,
		};
	}

	if (matchedProvince) {
		return {
			provinceCode: matchedProvince.code,
			cityMunicipalityCode: "",
		};
	}

	return null;
}

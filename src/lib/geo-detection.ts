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

function getProvinceAliases(province: GeoProvince) {
	const aliases = new Set<string>([province.name]);

	for (const fragment of province.name.split("/")) {
		const trimmedFragment = fragment.trim();
		if (trimmedFragment) {
			aliases.add(trimmedFragment);
		}
	}

	if (province.code === "PH-NCR") {
		aliases.add("NCR");
		aliases.add("Metro Manila");
		aliases.add("National Capital Region");
	}

	return [...aliases];
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
			getProvinceAliases(province).some((alias) =>
				containsWholePhrase(normalizedAddress, normalizeText(alias)),
			),
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

export const SITE_URL = "https://fuelwatchph.com";
export const SITE_NAME = "FuelWatch PH";
export const DEFAULT_SEO_TITLE =
	"FuelWatch PH - Find Fuel Prices Near You";
export const DEFAULT_SEO_DESCRIPTION =
	"Find, compare, and report fuel prices across the Philippines with community-powered station updates.";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logo-horizon.png`;

export type RouteSeoConfig = {
	title: string;
	description: string;
	path: string;
	robots?: string;
};

export const PUBLIC_ROUTE_SEO: RouteSeoConfig[] = [
	{
		path: "/",
		title: DEFAULT_SEO_TITLE,
		description: DEFAULT_SEO_DESCRIPTION,
	},
	{
		path: "/map",
		title: "Fuel Station Map - FuelWatch PH",
		description:
			"Use the FuelWatch PH map to find nearby gas stations, compare prices, and report updated fuel prices.",
	},
	{
		path: "/search",
		title: "Search Gas Stations - FuelWatch PH",
		description:
			"Search Philippine gas stations by name, fuel type, availability, price, and location.",
	},
	{
		path: "/donate",
		title: "Donate - FuelWatch PH",
		description:
			"Support FuelWatch PH and help keep community fuel price tools available for Filipino drivers.",
	},
	{
		path: "/about-us",
		title: "About FuelWatch PH",
		description:
			"Learn about FuelWatch PH and its community-powered mission to improve fuel price transparency in the Philippines.",
	},
	{
		path: "/contact-us",
		title: "Contact FuelWatch PH",
		description:
			"Contact FuelWatch PH for support, station claims, partnerships, and platform concerns.",
	},
	{
		path: "/privacy-policy",
		title: "Privacy Policy - FuelWatch PH",
		description:
			"Read how FuelWatch PH handles account information, reports, station submissions, and location-aware features.",
	},
	{
		path: "/terms",
		title: "Terms of Use - FuelWatch PH",
		description:
			"Review the terms for using FuelWatch PH, submitting reports, and accessing community fuel price information.",
	},
	{
		path: "/station-experiences",
		title: "Fuel Station Experiences - FuelWatch PH",
		description:
			"Read community fuel station experiences and feedback shared through FuelWatch PH.",
	},
];

export function buildCanonicalUrl(pathname: string) {
	if (pathname === "/") {
		return SITE_URL;
	}

	return `${SITE_URL}${pathname}`;
}

export function getRouteSeoConfig(pathname: string): RouteSeoConfig {
	const exactMatch = PUBLIC_ROUTE_SEO.find((route) => route.path === pathname);
	if (exactMatch) {
		return exactMatch;
	}

	const isPrivateOrUtilityRoute =
		pathname.startsWith("/admin") ||
		pathname.startsWith("/lgu") ||
		pathname.startsWith("/auth") ||
		pathname.startsWith("/profile") ||
		pathname.startsWith("/manager") ||
		pathname.startsWith("/embed") ||
		pathname.startsWith("/report") ||
		pathname.startsWith("/admin-access-request") ||
		pathname.startsWith("/admin-invite");

	return {
		path: pathname,
		title: isPrivateOrUtilityRoute
			? `${SITE_NAME} App`
			: DEFAULT_SEO_TITLE,
		description: DEFAULT_SEO_DESCRIPTION,
		robots: isPrivateOrUtilityRoute ? "noindex, nofollow" : "index, follow",
	};
}

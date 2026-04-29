import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
	buildCanonicalUrl,
	DEFAULT_OG_IMAGE,
	getRouteSeoConfig,
	SITE_NAME,
	SITE_URL,
} from "@/lib/seo";

function upsertMeta(selector: string, attributes: Record<string, string>) {
	const existing = document.head.querySelector<HTMLMetaElement>(selector);
	const element = existing ?? document.createElement("meta");

	Object.entries(attributes).forEach(([key, value]) => {
		element.setAttribute(key, value);
	});

	if (!existing) {
		document.head.appendChild(element);
	}
}

function upsertLink(selector: string, attributes: Record<string, string>) {
	const existing = document.head.querySelector<HTMLLinkElement>(selector);
	const element = existing ?? document.createElement("link");

	Object.entries(attributes).forEach(([key, value]) => {
		element.setAttribute(key, value);
	});

	if (!existing) {
		document.head.appendChild(element);
	}
}

function upsertJsonLd(id: string, data: unknown) {
	const existing = document.getElementById(id);
	const element = existing ?? document.createElement("script");

	element.id = id;
	element.type = "application/ld+json";
	element.textContent = JSON.stringify(data);

	if (!existing) {
		document.head.appendChild(element);
	}
}

export function RouteSeo() {
	const location = useLocation();

	useEffect(() => {
		const seo = getRouteSeoConfig(location.pathname);
		const canonicalUrl = buildCanonicalUrl(seo.path);
		const robots = seo.robots ?? "index, follow";

		document.title = seo.title;
		upsertMeta('meta[name="description"]', {
			name: "description",
			content: seo.description,
		});
		upsertMeta('meta[name="robots"]', {
			name: "robots",
			content: robots,
		});
		upsertLink('link[rel="canonical"]', {
			rel: "canonical",
			href: canonicalUrl,
		});

		upsertMeta('meta[property="og:site_name"]', {
			property: "og:site_name",
			content: SITE_NAME,
		});
		upsertMeta('meta[property="og:type"]', {
			property: "og:type",
			content: "website",
		});
		upsertMeta('meta[property="og:title"]', {
			property: "og:title",
			content: seo.title,
		});
		upsertMeta('meta[property="og:description"]', {
			property: "og:description",
			content: seo.description,
		});
		upsertMeta('meta[property="og:url"]', {
			property: "og:url",
			content: canonicalUrl,
		});
		upsertMeta('meta[property="og:image"]', {
			property: "og:image",
			content: DEFAULT_OG_IMAGE,
		});

		upsertMeta('meta[name="twitter:card"]', {
			name: "twitter:card",
			content: "summary_large_image",
		});
		upsertMeta('meta[name="twitter:title"]', {
			name: "twitter:title",
			content: seo.title,
		});
		upsertMeta('meta[name="twitter:description"]', {
			name: "twitter:description",
			content: seo.description,
		});
		upsertMeta('meta[name="twitter:image"]', {
			name: "twitter:image",
			content: DEFAULT_OG_IMAGE,
		});

		upsertJsonLd("fuelwatch-website-jsonld", {
			"@context": "https://schema.org",
			"@type": "WebSite",
			name: SITE_NAME,
			url: SITE_URL,
			description: seo.description,
			potentialAction: {
				"@type": "SearchAction",
				target: `${SITE_URL}/search?q={search_term_string}`,
				"query-input": "required name=search_term_string",
			},
		});
		upsertJsonLd("fuelwatch-organization-jsonld", {
			"@context": "https://schema.org",
			"@type": "Organization",
			name: SITE_NAME,
			url: SITE_URL,
			logo: DEFAULT_OG_IMAGE,
			sameAs: ["https://www.facebook.com/fuelwatchph"],
		});
	}, [location.pathname]);

	return null;
}

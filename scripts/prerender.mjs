/**
 * Build-time prerendering for the FuelWatch PH SPA.
 *
 * Boots the built app with `vite preview`, drives each public route in a
 * headless browser so the real client render + RouteSeo head injection run,
 * then writes the resulting static HTML to `dist/<route>/index.html`.
 *
 * Crawlers and social/link-preview bots then receive real <title>/<meta>/OG
 * markup instead of an empty `<div id="root">` shell. The client rehydrates
 * this markup (see src/main.tsx).
 *
 * Browser: reuses the system Google Chrome via Playwright's `channel: "chrome"`
 * so no separate Chromium download is required. Override with PRERENDER_CHANNEL.
 *
 * Keep this list in sync with the public routes in src/lib/seo.ts.
 */
import { preview } from "vite";
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROUTES = [
	"/",
	"/map",
	"/search",
	"/donate",
	"/about-us",
	"/contact-us",
	"/privacy-policy",
	"/terms",
	"/station-experiences",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist");
const channel = process.env.PRERENDER_CHANNEL || "chrome";

async function run() {
	const server = await preview({
		preview: { port: 4180, strictPort: true },
	});
	const base = `http://localhost:4180`;

	const browser = await chromium.launch({ channel, headless: true });
	const page = await browser.newPage();

	for (const route of ROUTES) {
		const url = `${base}${route}`;
		// "load" (not "networkidle") — don't block on background Supabase
		// fetches; we only need the shell + RouteSeo head tags.
		await page.goto(url, { waitUntil: "load", timeout: 30_000 });
		// Ensure the app actually rendered into #root before snapshotting.
		await page.waitForFunction(
			() => {
				const root = document.getElementById("root");
				return !!root && root.childElementCount > 0;
			},
			{ timeout: 30_000 },
		);
		// Give RouteSeo effects a tick to upsert head tags.
		await page.waitForTimeout(300);

		const html = "<!doctype html>\n" + (await page.content())
			.replace(/^<!DOCTYPE html>/i, "")
			.trimStart();

		const outFile =
			route === "/"
				? join(distDir, "index.html")
				: join(distDir, route, "index.html");
		await mkdir(dirname(outFile), { recursive: true });
		await writeFile(outFile, html, "utf8");
		console.log(`prerendered ${route} -> ${outFile}`);
	}

	await browser.close();
	await server.httpServer.close();
}

run().catch((err) => {
	console.error("[prerender] failed:", err);
	process.exit(1);
});

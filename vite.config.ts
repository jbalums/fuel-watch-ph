import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(() => ({
	server: {
		host: "::",
		port: 8080,
		hmr: {
			overlay: false,
		},
	},
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: [
				"favicon.ico",
				"apple-touch-icon.png",
				"icons/192x192.png",
				"icons/512x512.png",
				"icons/maskable-512x512.png",
			],
			manifest: {
				name: "FuelWatch PH",
				short_name: "FuelWatch",
				description:
					"Find, compare, and report fuel prices across the Philippines.",
				theme_color: "#f59e0b",
				background_color: "#020617",
				display: "standalone",
				orientation: "portrait",
				scope: "/",
				start_url: "/",
				categories: ["navigation", "utilities", "travel"],
				icons: [
					{
						src: "/icons/192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "/icons/512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "/icons/maskable-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				navigateFallback: "/",
				cleanupOutdatedCaches: true,
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: "StaleWhileRevalidate",
						options: {
							cacheName: "google-fonts-stylesheets",
						},
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "google-fonts-webfonts",
							expiration: {
								maxEntries: 20,
								maxAgeSeconds: 60 * 60 * 24 * 365,
							},
						},
					},
					{
						urlPattern:
							/^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/.*/i,
						handler: "NetworkFirst",
						options: {
							cacheName: "supabase-rest-read-cache",
							networkTimeoutSeconds: 5,
							expiration: {
								maxEntries: 80,
								maxAgeSeconds: 60 * 5,
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern:
							/^https:\/\/overpass-api\.de\/api\/(status|interpreter).*/i,
						handler: "NetworkFirst",
						options: {
							cacheName: "overpass-discovery-cache",
							networkTimeoutSeconds: 5,
							expiration: {
								maxEntries: 40,
								maxAgeSeconds: 60 * 60,
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
		dedupe: [
			"react",
			"react-dom",
			"react/jsx-runtime",
			"react/jsx-dev-runtime",
		],
	},
}));

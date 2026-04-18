/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_GOOGLE_CLIENT_ID?: string;
	readonly VITE_GOOGLE_CLIENT_SECRET?: string;
	readonly VITE_GOOGLE_MAPS_API_KEY?: string;
	readonly VITE_SUPABASE_PROJECT_ID?: string;
	readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
	readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

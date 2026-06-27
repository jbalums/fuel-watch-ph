import { createRoot, hydrateRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

registerSW({
	immediate: true,
});

const container = document.getElementById("root")!;

// Prerendered routes (see scripts/prerender.mjs) ship static HTML inside #root.
// Reuse that markup via hydration instead of wiping it with a fresh render.
if (container.hasChildNodes()) {
	hydrateRoot(container, <App />);
} else {
	createRoot(container).render(<App />);
}

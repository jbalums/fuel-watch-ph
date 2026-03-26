import L from "leaflet";

type DefaultIconPrototype = L.Icon.Default & {
  _getIconUrl?: string;
};

delete (L.Icon.Default.prototype as DefaultIconPrototype)._getIconUrl;

export const MANILA_CENTER: [number, number] = [14.5995, 120.9842];
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';
export const CARTO_LIGHT_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
export const ESRI_WORLD_IMAGERY_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_WORLD_IMAGERY_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export type BasemapOption = "standard" | "satellite";

export const BASEMAP_CONFIG: Record<
  BasemapOption,
  { label: string; url: string; attribution: string }
> = {
  standard: {
    label: "Standard",
    url: CARTO_LIGHT_TILE_URL,
    attribution: OSM_ATTRIBUTION,
  },
  satellite: {
    label: "Satellite",
    url: ESRI_WORLD_IMAGERY_TILE_URL,
    attribution: ESRI_WORLD_IMAGERY_ATTRIBUTION,
  },
};

export function createPinIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

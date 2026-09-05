import { getRuntimeConfig } from "@/config/runtime-config";

export class BasemapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BasemapError";
  }
}

export function getBasemapStyleUrl(): string {
  const config = getRuntimeConfig();
  if (!config) {
    throw new BasemapError("Konfigurasi peta tidak tersedia.");
  }
  return config.basemapStyleUrl;
}

/**
 * Structured so the UI can render real links. A markup string rendered as a
 * text node showed the raw tags to every user.
 */
export const BASEMAP_ATTRIBUTION_LINKS = [
  { label: "OpenStreetMap", href: "https://openstreetmap.org/copyright" },
  { label: "OpenFreeMap", href: "https://openfreemap.org" },
] as const;

/** Plain-text form for canvases and files, which cannot hold links. */
export const BASEMAP_ATTRIBUTION_TEXT =
  "Route data \u00a9 OpenStreetMap contributors \u2014 openstreetmap.org/copyright";

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

export const BASEMAP_ATTRIBUTION =
  '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://openfreemap.org">OpenFreeMap</a>';

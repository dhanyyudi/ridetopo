declare global {
  interface Navigator {
    canShare(data?: ShareData): boolean;
  }

  interface Window {
    maplibregl?: typeof import("maplibre-gl");
  }
}

export {};

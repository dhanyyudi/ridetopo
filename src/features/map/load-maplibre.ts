/**
 * Load MapLibre together with its stylesheet.
 *
 * The stylesheet is not optional. Markers, controls, and popups are plain DOM
 * that MapLibre positions through `.maplibregl-*` rules — without them every
 * marker lays out as a static block and lands nowhere near its coordinates.
 * Both imports are dynamic so the map still ships in its own chunk.
 */
export async function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  const [maplibregl] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  return maplibregl;
}

/**
 * Basemap styles reference sprite icons that the sprite sheet does not always
 * contain. MapLibre logs a warning for each one, several per tile. Answer with
 * a transparent pixel so the console stays readable and the map is unchanged.
 */
export function silenceMissingStyleImages(map: import("maplibre-gl").Map): void {
  map.on("styleimagemissing", (event) => {
    const id = event.id;
    if (!id || map.hasImage(id)) return;
    map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}

import type { Map } from "maplibre-gl";

type GeoJSONSource = {
  setData(data: GeoJSON.GeoJSON | string): void;
};

export const ROUTE_CASING_LAYER = "route-casing";
export const ROUTE_CORE_LAYER = "route-core";
export const ROUTE_HIT_LAYER = "route-hit";
export const ROUTE_SELECTION_LAYER = "route-selection";

export function addRouteCasing(map: Map, geometry: GeoJSON.LineString) {
  if (map.getSource(ROUTE_CASING_LAYER)) {
    (map.getSource(ROUTE_CASING_LAYER) as unknown as GeoJSONSource).setData(geometry);
    return;
  }

  map.addSource(ROUTE_CASING_LAYER, { type: "geojson", data: geometry });
  map.addLayer({
    id: ROUTE_CASING_LAYER,
    type: "line",
    source: ROUTE_CASING_LAYER,
    paint: {
      "line-color": "#ffffff",
      "line-width": 6,
      "line-opacity": 0.9,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  });
}

export function addRouteCore(map: Map, geometry: GeoJSON.LineString) {
  if (map.getSource(ROUTE_CORE_LAYER)) {
    (map.getSource(ROUTE_CORE_LAYER) as unknown as GeoJSONSource).setData(geometry);
    return;
  }

  map.addSource(ROUTE_CORE_LAYER, { type: "geojson", data: geometry });
  map.addLayer({
    id: ROUTE_CORE_LAYER,
    type: "line",
    source: ROUTE_CORE_LAYER,
    paint: {
      "line-color": "#0F766E",
      "line-width": 3,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  });
}

export function addRouteHitLayer(map: Map, geometry: GeoJSON.LineString) {
  if (map.getSource(ROUTE_HIT_LAYER)) {
    (map.getSource(ROUTE_HIT_LAYER) as unknown as GeoJSONSource).setData(geometry);
    return;
  }

  map.addSource(ROUTE_HIT_LAYER, { type: "geojson", data: geometry });
  map.addLayer({
    id: ROUTE_HIT_LAYER,
    type: "line",
    source: ROUTE_HIT_LAYER,
    paint: {
      "line-color": "transparent",
      "line-width": 24,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  });
}

export function removeRouteLayers(map: Map) {
  [ROUTE_HIT_LAYER, ROUTE_SELECTION_LAYER, ROUTE_CORE_LAYER, ROUTE_CASING_LAYER].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
}

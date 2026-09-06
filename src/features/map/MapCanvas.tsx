import { useEffect, useRef, useState } from "react";
import type { Position } from "@/domain/geo";
import type { TerrainSection } from "@/domain/elevation";
import type {
  LineLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import { COPY } from "@/content/id";
import { getBasemapStyleUrl, BASEMAP_ATTRIBUTION_LINKS } from "@/providers/basemap/open-free-map-provider";
import { distanceAlongRoute, cumulativeDistances } from "@/services/routing/calculate-overlap";
import { MapFallback } from "./MapFallback";
import { loadMapLibre, silenceMissingStyleImages } from "./load-maplibre";
import {
  ROUTE_CASING_LAYER,
  ROUTE_CORE_LAYER,
  ROUTE_HIT_LAYER,
  ROUTE_SELECTION_LAYER,
  ROUTE_DIRECTION_LAYER,
  ROUTE_ARROW_IMAGE,
  addRouteArrowImage,
  ROUTE_NEUTRAL_COLOR,
  ROUTE_SELECTION_COLOR,
  TERRAIN_COLOR_EXPRESSION,
  buildTerrainFeatures,
} from "./map-layers";

const ROUTE_CURSOR_LAYER = "route-cursor";

export interface MapMarker {
  id: string;
  position: Position;
  label: string;
  sublabel?: string;
  kind: "origin" | "waypoint" | "destination" | "origin-destination";
}

interface Props {
  markers: readonly MapMarker[];
  routeGeometry: readonly Position[] | null;
  /** Terrain sections colour the route; omit for a single neutral line. */
  terrain?: readonly TerrainSection[] | null;
  selectionGeometry?: readonly Position[] | null;
  /** Bring this stretch into view — the ruas or corridor under review. */
  focusGeometry?: readonly Position[] | null;
  /** Distance along the route to mark, for chart/map cross-highlighting. */
  cursorDistanceMeters?: number | null;
  /** What to say about that point: distance, elevation, gradient. */
  cursorLabel?: string | null;
  /** Tapping anywhere on the map places a location instead of reading it. */
  pickMode?: boolean;
  pickCandidate?: Position | null;
  onPick?: ((position: Position) => void) | undefined;
  /** Pointer moved along the route. */
  onRouteHover?: ((distanceMeters: number | null) => void) | undefined;
  fitPadding?: number;
  onRouteClick?: (distanceMeters: number) => void;
  className?: string;
  offline?: boolean;
  /** Reports whether the map is unusable, so callers can stop pointing at it. */
  onBasemapStatusChange?: ((unavailable: boolean) => void) | undefined;
}

const DEFAULT_CENTER: [number, number] = [106.827, -6.175];

let maplibreModule: typeof import("maplibre-gl") | null = null;

export function MapCanvas({
  markers,
  routeGeometry,
  terrain,
  selectionGeometry,
  focusGeometry,
  cursorDistanceMeters,
  cursorLabel,
  pickMode = false,
  pickCandidate,
  onPick,
  onRouteHover,
  fitPadding = 80,
  onRouteClick,
  className,
  offline = false,
  onBasemapStatusChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [cursorScreenPoint, setCursorScreenPoint] = useState<{ x: number; y: number } | null>(null);

  /* Held in refs so a new callback or a new route never tears down the map. */
  const routeClickRef = useRef(onRouteClick);
  routeClickRef.current = onRouteClick;
  const routeHoverRef = useRef(onRouteHover);
  routeHoverRef.current = onRouteHover;
  const pickRef = useRef<{ active: boolean; onPick: Props["onPick"] }>({
    active: false,
    onPick: undefined,
  });
  pickRef.current = { active: pickMode, onPick };
  const pickMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const routeGeometryRef = useRef(routeGeometry);
  routeGeometryRef.current = routeGeometry;

  /* Telling someone to tap the map beside the panel is worse than useless
     when there is no map to tap — a browser without WebGL, or offline. */
  const basemapStatusRef = useRef(onBasemapStatusChange);
  basemapStatusRef.current = onBasemapStatusChange;
  useEffect(() => {
    basemapStatusRef.current?.(offline || basemapFailed);
  }, [offline, basemapFailed]);

  /* Init map once — never online-required when offline */
  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;

    void loadMapLibre().then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      maplibreModule = maplibregl;

      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: getBasemapStyleUrl(),
          center: DEFAULT_CENTER,
          zoom: 11,
          attributionControl: false,
        });
        mapRef.current = map;
        const created0 = map;
        silenceMissingStyleImages(map);
        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.on("load", () => {
          if (!cancelled) setMapLoaded(true);
        });

        /* Whole-map click: placing a point beats inspecting the route while
           the composer is waiting for a location. */
        created0.on("click", (e) => {
          const picking = pickRef.current;
          if (!picking.active || !picking.onPick) return;
          picking.onPick([e.lngLat.lng, e.lngLat.lat]);
        });

        map.on("click", ROUTE_HIT_LAYER, (e) => {
          if (pickRef.current.active) return;
          const handler = routeClickRef.current;
          const geometry = routeGeometryRef.current;
          if (!handler || !geometry || geometry.length < 2) return;
          /* Project the tap onto the route instead of trusting feature
             properties: the source is one plain geometry. */
          handler(distanceAlongRoute(geometry, [e.lngLat.lng, e.lngLat.lat]));
        });

        const created = map;
        created.on("mousemove", ROUTE_HIT_LAYER, (e) => {
          const handler = routeHoverRef.current;
          const geometry = routeGeometryRef.current;
          if (!handler || !geometry || geometry.length < 2) return;
          created.getCanvas().style.cursor = "pointer";
          handler(distanceAlongRoute(geometry, [e.lngLat.lng, e.lngLat.lat]));
        });

        created.on("mouseleave", ROUTE_HIT_LAYER, () => {
          created.getCanvas().style.cursor = "";
          routeHoverRef.current?.(null);
        });
      } catch {
        setBasemapFailed(true);
      }
    });

    return () => {
      cancelled = true;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [offline]);

  /* Markers */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    if (!maplibreModule) return;

    for (const marker of markers) {
      const el = document.createElement("div");
      el.className = `ridetopo-marker marker-${marker.kind}`;
      const inner = document.createElement("span");
      inner.className = "marker-inner";
      inner.textContent = marker.label;
      el.appendChild(inner);

      if (marker.sublabel) {
        const time = document.createElement("span");
        time.className = "marker-time";
        time.textContent = marker.sublabel;
        el.appendChild(time);
      }

      el.setAttribute("role", "img");
      el.setAttribute(
        "aria-label",
        marker.kind === "origin-destination"
          ? COPY.startAndEnd
          : marker.kind === "destination"
            ? COPY.turnaround
            : marker.label,
      );
      if (marker.sublabel) {
        el.setAttribute(
          "aria-label",
          `${el.getAttribute("aria-label") ?? marker.label} — ${marker.sublabel}`,
        );
      }

      markersRef.current.push(
        new maplibreModule.Marker({ element: el, anchor: "center" })
          .setLngLat([marker.position[0], marker.position[1]])
          .addTo(map),
      );
    }
  }, [markers, mapLoaded]);

  /* Route geometry, coloured by terrain when the analysis is available */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!routeGeometry || routeGeometry.length < 2) {
      if (map.getLayer(ROUTE_DIRECTION_LAYER)) map.removeLayer(ROUTE_DIRECTION_LAYER);
      removeLayer(map, ROUTE_CASING_LAYER);
      removeLayer(map, ROUTE_CORE_LAYER);
      removeLayer(map, ROUTE_HIT_LAYER);
      return;
    }

    const line: GeoJSON.LineString = {
      type: "LineString",
      coordinates: routeGeometry.map((p) => [p[0], p[1]]),
    };

    upsertLine(map, ROUTE_CASING_LAYER, line, {
      "line-color": "#ffffff",
      "line-width": 9,
      "line-opacity": 0.95,
    });

    if (terrain && terrain.length > 0) {
      upsertLine(map, ROUTE_CORE_LAYER, buildTerrainFeatures(routeGeometry, terrain), {
        "line-color": TERRAIN_COLOR_EXPRESSION,
        "line-width": 5,
      } as NonNullable<LineLayerSpecification["paint"]>);
    } else {
      upsertLine(map, ROUTE_CORE_LAYER, line, {
        "line-color": ROUTE_NEUTRAL_COLOR,
        "line-width": 5,
      });
    }

    upsertLine(map, ROUTE_HIT_LAYER, line, {
      "line-color": "rgba(0,0,0,0)",
      "line-width": 26,
    });

    /* Which way the ride goes. */
    addRouteArrowImage(map);
    if (!map.getLayer(ROUTE_DIRECTION_LAYER)) {
      map.addLayer({
        id: ROUTE_DIRECTION_LAYER,
        type: "symbol",
        source: ROUTE_HIT_LAYER,
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 110,
          "icon-image": ROUTE_ARROW_IMAGE,
          "icon-size": 0.75,
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      } satisfies SymbolLayerSpecification);
    }
  }, [routeGeometry, terrain, mapLoaded]);

  /* Fit bounds on new geometry */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !maplibreModule) return;
    if (!routeGeometry || routeGeometry.length < 2) return;

    const bounds = routeGeometry.reduce(
      (acc, p) => acc.extend([p[0], p[1]] as [number, number]),
      new maplibreModule.LngLatBounds(),
    );
    map.fitBounds(bounds, { padding: fitPadding, duration: 250 });
  }, [routeGeometry, fitPadding, mapLoaded]);

  /* Zoom to whatever is under review, so picking a ruas from the list shows
     you where it is instead of leaving you to hunt for the highlight. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !maplibreModule) return;
    if (!focusGeometry || focusGeometry.length < 2) return;

    const bounds = focusGeometry.reduce(
      (acc, p) => acc.extend([p[0], p[1]] as [number, number]),
      new maplibreModule.LngLatBounds(),
    );
    map.fitBounds(bounds, { padding: 120, maxZoom: 16, duration: 500 });
  }, [focusGeometry, mapLoaded]);

  /* Selection overlay */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!selectionGeometry || selectionGeometry.length < 2) {
      removeLayer(map, ROUTE_SELECTION_LAYER);
      return;
    }
    upsertLine(
      map,
      ROUTE_SELECTION_LAYER,
      {
        type: "LineString",
        coordinates: selectionGeometry.map((p) => [p[0], p[1]]),
      },
      { "line-color": ROUTE_SELECTION_COLOR, "line-width": 8 },
    );
  }, [selectionGeometry, mapLoaded]);

  /* Chart cursor mirrored onto the route */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const point =
      cursorDistanceMeters != null && routeGeometry && routeGeometry.length >= 2
        ? positionAtDistance(routeGeometry, cursorDistanceMeters)
        : null;

    if (!point) {
      removeLayer(map, ROUTE_CURSOR_LAYER);
      return;
    }

    upsertCircle(map, ROUTE_CURSOR_LAYER, {
      type: "Point",
      coordinates: [point[0], point[1]],
    });

    setCursorScreenPoint(map.project([point[0], point[1]]));
  }, [cursorDistanceMeters, routeGeometry, mapLoaded]);

  /* The point being placed, before it is saved. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !maplibreModule) return;

    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
    if (!pickCandidate) return;

    pickMarkerRef.current = new maplibreModule.Marker({ color: ROUTE_SELECTION_COLOR })
      .setLngLat([pickCandidate[0], pickCandidate[1]])
      .addTo(map);

    return () => {
      pickMarkerRef.current?.remove();
      pickMarkerRef.current = null;
    };
  }, [pickCandidate, mapLoaded]);

  /* Crosshair while placing a point. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.getCanvas().style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode, mapLoaded]);

  /* Keep the canvas in sync with container resizes */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [basemapFailed]);

  return (
    <div
      className={className ? `map-host ${className}` : "map-host"}
      data-map-ready={mapLoaded ? "true" : "false"}
      data-selection-points={selectionGeometry?.length ?? 0}
      data-cursor-distance={cursorDistanceMeters ?? ""}
    >
      <div className="map-container" ref={containerRef} />
      {cursorLabel && cursorScreenPoint && (
        <div
          className="map-cursor-readout"
          style={{ left: cursorScreenPoint.x, top: cursorScreenPoint.y }}
          role="status"
        >
          {cursorLabel}
        </div>
      )}
      {offline && <MapFallback message={COPY.offlineMapUnavailable} />}
      {!offline && basemapFailed && <MapFallback message={COPY.errorBasemap} />}
      {!offline && !basemapFailed && (
        <p className="attribution-line map-attribution">
          {"© "}
          <a href={BASEMAP_ATTRIBUTION_LINKS[0].href} target="_blank" rel="noreferrer">
            {BASEMAP_ATTRIBUTION_LINKS[0].label}
          </a>
          {" contributors | "}
          <a href={BASEMAP_ATTRIBUTION_LINKS[1].href} target="_blank" rel="noreferrer">
            {BASEMAP_ATTRIBUTION_LINKS[1].label}
          </a>
        </p>
      )}
    </div>
  );
}

/** Position on the route at a travelled distance. */
function positionAtDistance(
  geometry: readonly Position[],
  distanceMeters: number,
): Position | null {
  const cumulative = cumulativeDistances(geometry);
  const total = cumulative[cumulative.length - 1] ?? 0;
  const target = Math.max(0, Math.min(total, distanceMeters));

  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i]! < target) continue;
    const a = geometry[i - 1]!;
    const b = geometry[i]!;
    const span = cumulative[i]! - cumulative[i - 1]! || 1;
    const t = (target - cumulative[i - 1]!) / span;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  return geometry[geometry.length - 1] ?? null;
}

function upsertLine(
  map: import("maplibre-gl").Map,
  id: string,
  data: GeoJSON.GeoJSON,
  paint: NonNullable<LineLayerSpecification["paint"]>,
) {
  const source = map.getSource(id);
  if (source) {
    (source as unknown as { setData: (d: GeoJSON.GeoJSON) => void }).setData(data);
    /* Paint too: the route line switches between terrain colours and one
       neutral colour, and an existing layer keeps its old paint otherwise. */
    if (map.getLayer(id)) {
      for (const [property, value] of Object.entries(paint)) {
        map.setPaintProperty(id, property, value);
      }
    }
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id,
    type: "line",
    source: id,
    paint,
    layout: { "line-cap": "round", "line-join": "round" },
  } satisfies LineLayerSpecification);
}

function upsertCircle(
  map: import("maplibre-gl").Map,
  id: string,
  data: GeoJSON.Point,
) {
  const source = map.getSource(id);
  if (source) {
    (source as unknown as { setData: (d: GeoJSON.GeoJSON) => void }).setData(data);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id,
    type: "circle",
    source: id,
    paint: {
      "circle-radius": 7,
      "circle-color": "#ffffff",
      "circle-stroke-color": ROUTE_SELECTION_COLOR,
      "circle-stroke-width": 3,
    },
  } satisfies CircleLayerSpecification);
}

function removeLayer(map: import("maplibre-gl").Map, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
}

import { useEffect, useRef, useState } from "react";
import type { Position } from "@/domain/geo";
import type { LineLayerSpecification } from "maplibre-gl";
import { COPY } from "@/content/id";
import { getBasemapStyleUrl, BASEMAP_ATTRIBUTION } from "@/providers/basemap/open-free-map-provider";
import { MapFallback } from "./MapFallback";
import {
  ROUTE_CASING_LAYER,
  ROUTE_CORE_LAYER,
  ROUTE_HIT_LAYER,
  ROUTE_SELECTION_LAYER,
} from "./map-layers";

export interface MapMarker {
  id: string;
  position: Position;
  label: string;
  kind: "origin" | "waypoint" | "destination" | "origin-destination";
}

interface Props {
  markers: readonly MapMarker[];
  routeGeometry: readonly Position[] | null;
  routeColor?: string;
  selectionGeometry?: readonly Position[] | null;
  fitPadding?: number;
  onRouteClick?: (distanceMeters: number) => void;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [106.827, -6.175];

let maplibreModule: typeof import("maplibre-gl") | null = null;

export function MapCanvas({
  markers,
  routeGeometry,
  routeColor,
  selectionGeometry,
  fitPadding = 80,
  onRouteClick,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  /* Init map once */
  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      maplibreModule = maplibregl;

      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: getBasemapStyleUrl(),
          center: DEFAULT_CENTER,
          zoom: 11,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.on("load", () => {
          if (!cancelled) setMapLoaded(true);
        });

        map.on("click", ROUTE_HIT_LAYER, (e) => {
          if (!onRouteClick) return;
          const feature = e.features?.[0];
          if (feature?.properties?.distanceMeters != null) {
            onRouteClick(Number(feature.properties.distanceMeters));
          }
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
  }, [onRouteClick]);

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
      el.setAttribute("role", "img");
      el.setAttribute(
        "aria-label",
        marker.kind === "origin-destination"
          ? COPY.startAndEnd
          : marker.kind === "destination"
            ? COPY.turnaround
            : marker.label,
      );

      markersRef.current.push(
        new maplibreModule.Marker({ element: el, anchor: "center" })
          .setLngLat([marker.position[0], marker.position[1]])
          .addTo(map),
      );
    }
  }, [markers, mapLoaded]);

  /* Route geometry */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!routeGeometry || routeGeometry.length < 2) {
      removeLine(map, ROUTE_CASING_LAYER);
      removeLine(map, ROUTE_CORE_LAYER);
      removeLine(map, ROUTE_HIT_LAYER);
      return;
    }

    const geojson: GeoJSON.LineString = {
      type: "LineString",
      coordinates: routeGeometry.map((p) => [p[0], p[1]]),
    };

    upsertLine(map, ROUTE_CASING_LAYER, geojson, {
      "line-color": "#ffffff",
      "line-width": 9,
      "line-opacity": 0.95,
    });
    upsertLine(map, ROUTE_CORE_LAYER, geojson, {
      "line-color": routeColor ?? "#0F766E",
      "line-width": 5,
    });
    upsertLine(map, ROUTE_HIT_LAYER, geojson, {
      "line-color": "rgba(0,0,0,0)",
      "line-width": 26,
    });
  }, [routeGeometry, routeColor, mapLoaded]);

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

  /* Selection overlay */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!selectionGeometry || selectionGeometry.length < 2) {
      removeLine(map, ROUTE_SELECTION_LAYER);
      return;
    }
    const geojson: GeoJSON.LineString = {
      type: "LineString",
      coordinates: selectionGeometry.map((p) => [p[0], p[1]]),
    };
    upsertLine(map, ROUTE_SELECTION_LAYER, geojson, {
      "line-color": "#C2410C",
      "line-width": 8,
    });
  }, [selectionGeometry, mapLoaded]);

  return (
    <div className={className ? `map-host ${className}` : "map-host"}>
      <div className="map-container" ref={containerRef} />
      {basemapFailed && <MapFallback message={COPY.errorBasemap} />}
      {!basemapFailed && (
        <div className="attribution-line map-attribution" aria-hidden="true">
          {BASEMAP_ATTRIBUTION}
        </div>
      )}
    </div>
  );
}

function upsertLine(
  map: import("maplibre-gl").Map,
  id: string,
  geojson: GeoJSON.LineString,
  paint: NonNullable<LineLayerSpecification["paint"]>,
) {
  if (map.getSource(id)) {
    (map.getSource(id) as unknown as { setData: (d: GeoJSON.GeoJSON) => void }).setData(geojson);
    return;
  }
  map.addSource(id, { type: "geojson", data: geojson });
  const layerSpec: LineLayerSpecification = {
    id,
    type: "line",
    source: id,
    paint,
    layout: { "line-cap": "round", "line-join": "round" },
  };
  map.addLayer(layerSpec);
}

function removeLine(map: import("maplibre-gl").Map, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
}

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { COPY } from "@/content/id";
import type { Position } from "@/domain/geo";
import { getBasemapStyleUrl } from "@/providers/basemap/open-free-map-provider";
import { MapFallback } from "@/features/map/MapFallback";
import { Check, X } from "lucide-react";

interface Props {
  open: boolean;
  initialPosition: Position | null;
  onSave: (position: Position) => void;
  onCancel: () => void;
}

const DEFAULT_CENTER: [number, number] = [106.827, -6.175];

export function MapPicker({ open, initialPosition, onSave, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const [candidate, setCandidate] = useState<Position | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const saveRef = useRef(onSave);
  const cancelRef = useRef(onCancel);
  const initialRef = useRef(initialPosition);
  saveRef.current = onSave;
  cancelRef.current = onCancel;
  initialRef.current = initialPosition;

  const placeCandidate = useCallback((pos: Position) => {
    setCandidate(pos);
    const map = mapRef.current;
    if (!map) return;
    void import("maplibre-gl").then((maplibregl) => {
      markerRef.current?.remove();
      markerRef.current = new maplibregl.Marker({ color: "#0F766E" })
        .setLngLat([pos[0], pos[1]])
        .addTo(map);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;

    setCandidate(null);
    setMapError(false);
    setMapReady(false);

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const start = initialRef.current ?? DEFAULT_CENTER;
      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: getBasemapStyleUrl(),
          center: [start[0], start[1]],
          zoom: 13,
          attributionControl: { compact: true },
        });
        mapRef.current = map;

        map.on("click", (e) => {
          placeCandidate([e.lngLat.lng, e.lngLat.lat]);
        });
        map.on("load", () => {
          if (!cancelled) setMapReady(true);
        });

        if (initialRef.current) {
          placeCandidate(initialRef.current);
        }
      } catch {
        setMapError(true);
      }
    });

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current();
    };
    document.addEventListener("keydown", escHandler);

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", escHandler);
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
      setCandidate(null);
    };
  }, [open, placeCandidate]);

  if (!open) return null;

  return createPortal(
    <div className="map-picker" role="dialog" aria-modal="true" aria-label={COPY.mapPickTitle}>
      <div className="map-picker-header">
        <h2 className="map-picker-title">{COPY.mapPickTitle}</h2>
        <p className="map-picker-hint">{COPY.mapPickHint}</p>
      </div>

      <div className="map-picker-canvas" ref={containerRef} data-map-ready={mapReady ? "true" : "false"} />
      {mapError && <MapFallback />}

      <div className="map-picker-footer">
        <button type="button" className="btn btn-secondary" onClick={() => cancelRef.current()}>
          <X size={16} aria-hidden="true" />
          {COPY.mapPickCancel}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (candidate) saveRef.current(candidate);
          }}
          disabled={!candidate}
        >
          <Check size={16} aria-hidden="true" />
          {COPY.mapPickSave}
        </button>
      </div>
    </div>,
    document.body,
  );
}

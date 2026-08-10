import { useEffect, useRef, useState } from "react";
import { MapFallback } from "./MapFallback";
import { BASEMAP_ATTRIBUTION } from "@/providers/basemap/open-free-map-provider";

interface Props {
  onMapLoaded?: () => void;
  children?: React.ReactNode;
}

export function MapCanvas({ onMapLoaded, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;

    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [106.8, -6.2],
          zoom: 12,
          attributionControl: { compact: true },
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");

        map.on("load", () => {
          if (!cancelled) {
            setLoading(false);
            onMapLoaded?.();
          }
        });
      } catch {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [onMapLoaded]);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
      <div className="map-container" ref={containerRef} />
      {loading && <MapFallback message="Memuat peta..." />}
      {children}
      <div style={{
        position: "absolute",
        bottom: 4,
        right: 4,
        fontSize: "9px",
        color: "var(--color-text-tertiary)",
        background: "rgba(255,255,255,0.8)",
        padding: "2px 4px",
        borderRadius: "var(--radius-sm)",
        zIndex: 2,
      }}>
        {BASEMAP_ATTRIBUTION}
      </div>
    </div>
  );
}

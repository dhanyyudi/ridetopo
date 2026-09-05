import type { PlannedRoute, ElevationSample } from "@/domain/route";
import { createElevationInterpolator } from "@/domain/elevation";
import { cumulativeDistances } from "@/services/routing/calculate-overlap";
import { combinedElevationSamples } from "@/services/routing/merge-legs";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/** Full unsimplified combined geometry with distance-mapped elevation. */
function buildGpxContent(route: PlannedRoute): string {
  const date = new Date().toISOString().slice(0, 10);
  const originLabel = route.input.locations[0]?.label ?? "asal";
  const destLabel =
    route.input.locations[route.input.locations.length - 1]?.label ?? "tujuan";
  const name = `ridetopo-${safeSlug(originLabel)}-${safeSlug(destLabel)}-${date}`;

  const geometry = route.geometry;
  /* Return-leg samples are 0-based relative to the return leg; merge them
     onto the combined distance axis before interpolating. */
  const elevationProfile: ElevationSample[] = combinedElevationSamples(route);

  /* Distance profile over the combined geometry so elevation maps by
     cumulative distance, never by array index. */
  const cumulative = cumulativeDistances(geometry);
  /* Cursor-based: both arrays advance together, so a 500 km route does not
     rescan the elevation profile per vertex. */
  const elevationAt = createElevationInterpolator(elevationProfile);

  let trkpts = "";
  for (let i = 0; i < geometry.length; i++) {
    const pt = geometry[i]!;
    const distanceAtPoint = cumulative[i] ?? 0;
    const elevation = elevationAt(distanceAtPoint);
    trkpts += `    <trkpt lat="${pt[1]}" lon="${pt[0]}">\n`;
    if (elevation !== null) {
      trkpts += `      <ele>${round5(elevation)}</ele>\n`;
    }
    trkpts += "    </trkpt>\n";
  }

  let wpts = "";
  for (const loc of route.input.locations) {
    const isRoundTripOrigin = route.input.returnToStart && loc.role === "origin";
    const wptLabel = isRoundTripOrigin
      ? "Mulai/Selesai"
      : escapeXml(loc.label || "Titik");
    wpts += `  <wpt lat="${loc.position[1]}" lon="${loc.position[0]}">\n`;
    wpts += `    <name>${wptLabel}</name>\n`;
    wpts += "  </wpt>\n";
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RideTopo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${route.createdAt}</time>
  </metadata>
${wpts}  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}    </trkseg>
  </trk>
</gpx>`;
}

function round5(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2);
}

export function buildGpx(route: PlannedRoute): string {
  return buildGpxContent(route);
}

export function generateGpxFilename(route: PlannedRoute): string {
  const date = new Date().toISOString().slice(0, 10);
  const originLabel = route.input.locations[0]?.label ?? "asal";
  const destLabel =
    route.input.locations[route.input.locations.length - 1]?.label ?? "tujuan";
  return `ridetopo-${safeSlug(originLabel)}-${safeSlug(destLabel)}-${date}.gpx`;
}

export function generateGpxBlob(route: PlannedRoute): Blob {
  const gpx = buildGpxContent(route);
  return new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
}

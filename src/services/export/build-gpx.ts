import type { PlannedRoute, ElevationSample } from "@/domain/route";

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

export function buildGpx(route: PlannedRoute): string {
  const date = new Date().toISOString().slice(0, 10);
  const originLabel = route.input.locations[0]?.label ?? "asal";
  const destLabel = route.input.locations[route.input.locations.length - 1]?.label ?? "tujuan";
  const name = `ridetopo-${safeSlug(originLabel)}-${safeSlug(destLabel)}-${date}`;

  const allGeometry = route.geometry;
  const allElevation: ElevationSample[] = [
    ...route.outbound.elevation,
    ...(route.returnLeg?.elevation ?? []),
  ];

  let trkpts = "";
  for (let i = 0; i < allGeometry.length; i++) {
    const pt = allGeometry[i]!;
    const elev = allElevation[i];
    trkpts += `    <trkpt lat="${pt[1]}" lon="${pt[0]}">\n`;
    if (elev?.elevationMeters != null) {
      trkpts += `      <ele>${elev.elevationMeters}</ele>\n`;
    }
    trkpts += "    </trkpt>\n";
  }

  let wpts = "";
  for (const loc of route.input.locations) {
    const wptLabel =
      route.input.returnToStart && loc.role === "origin"
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

export function generateGpxFilename(route: PlannedRoute): string {
  const date = new Date().toISOString().slice(0, 10);
  const originLabel = route.input.locations[0]?.label ?? "asal";
  const destLabel = route.input.locations[route.input.locations.length - 1]?.label ?? "tujuan";
  return `ridetopo-${safeSlug(originLabel)}-${safeSlug(destLabel)}-${date}.gpx`;
}

export function generateGpxBlob(route: PlannedRoute): Blob {
  const gpx = buildGpx(route);
  return new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
}

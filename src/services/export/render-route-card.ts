import type { RouteCardData, RouteCardAssets } from "@/domain/export";
import type { Position } from "@/domain/geo";
import { COPY } from "@/content/id";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
export const CARD_PADDING = 96;
const ROUTE_COLOR = "#2DD4BF";
const BACKGROUND_COLOR = "#14201E";
const TEXT_COLOR = "#FFFFFF";

interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Project route geometry to Web Mercator, normalize bounds, preserve aspect
 * ratio, and center it inside a fixed drawing rectangle. Handles degenerate
 * geometries without rotation surprises or clipping.
 */
export function normalizeRouteSilhouette(
  geometry: readonly Position[],
  area: { x: number; y: number; width: number; height: number },
): ScreenPoint[] {
  if (geometry.length < 2) return [];

  const projected = geometry.map((p) => {
    const x = (p[0] * Math.PI) / 180;
    const y = Math.log(Math.tan(Math.PI / 4 + ((p[1] * Math.PI) / 180) / 2));
    return { x, y };
  });

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const p of projected) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  /* Degenerate spans: fit on the non-degenerate axis only. */
  let scale: number;
  if (spanX > 0 && spanY > 0) {
    scale = Math.min(area.width / spanX, area.height / spanY);
  } else if (spanX > 0) {
    scale = area.width / spanX;
  } else if (spanY > 0) {
    scale = area.height / spanY;
  } else {
    return [];
  }

  const drawWidth = spanX * scale;
  const drawHeight = spanY * scale;
  const offsetX = area.x + (area.width - drawWidth) / 2;
  const offsetY = area.y + (area.height - drawHeight) / 2;

  return projected.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + drawHeight - (p.y - minY) * scale,
  }));
}

/** Decimate the silhouette to a crisp, bounded polyline for drawing. */
export function simplifyForDisplay(points: readonly ScreenPoint[], maxPoints: number): ScreenPoint[] {
  if (points.length <= maxPoints) return [...points];
  const step = Math.ceil(points.length / maxPoints);
  const sampled = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1]!;
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

function drawRouteSilhouette(
  ctx: CanvasRenderingContext2D,
  points: readonly ScreenPoint[],
) {
  if (points.length < 2) return;

  const simplified = simplifyForDisplay(points, 400);
  ctx.beginPath();
  ctx.moveTo(simplified[0]!.x, simplified[0]!.y);
  for (let i = 1; i < simplified.length; i++) {
    ctx.lineTo(simplified[i]!.x, simplified[i]!.y);
  }
  ctx.strokeStyle = ROUTE_COLOR;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

let activeRender: Promise<unknown> | null = null;

export async function renderRouteCard(
  data: RouteCardData,
  assets: RouteCardAssets,
): Promise<Blob> {
  if (activeRender) {
    await activeRender;
  }

  const task = doRender(data, assets);
  activeRender = task;
  try {
    return await task;
  } finally {
    activeRender = null;
  }
}

async function doRender(data: RouteCardData, assets: RouteCardAssets): Promise<Blob> {
  /* Required local font must be ready before drawing */
  try {
    await document.fonts.load(`700 40px "${assets.fontFamily}"`);
    await document.fonts.load(`500 22px "${assets.fontFamily}"`);
  } catch {
    throw new Error("Font tidak dapat dimuat.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas tidak tersedia.");
  }

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  /* Rencana rute */
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `700 32px "${assets.fontFamily}"`;
  ctx.fillText(COPY.planTitle, CARD_PADDING, CARD_PADDING + 30);

  /* RideTopo mark */
  try {
    ctx.drawImage(assets.logo, CARD_PADDING, CARD_PADDING + 64, 64, 64);
  } catch {
    throw new Error("Logo tidak dapat dimuat.");
  }

  /* Jarak */
  ctx.font = `500 24px "${assets.fontFamily}"`;
  ctx.fillText(COPY.routeDistance, CARD_PADDING, CARD_PADDING + 200);
  ctx.font = `700 48px "${assets.fontFamily}"`;
  ctx.fillText(data.distanceLabel, CARD_PADDING, CARD_PADDING + 262);

  /* Elevasi naik (only when valid) */
  let cursorY = CARD_PADDING + 340;
  if (data.elevationGainLabel) {
    ctx.font = `500 24px "${assets.fontFamily}"`;
    ctx.fillText(COPY.elevationGain, CARD_PADDING, cursorY);
    ctx.font = `700 48px "${assets.fontFamily}"`;
    ctx.fillText(data.elevationGainLabel, CARD_PADDING, cursorY + 62);
    cursorY += 140;
  }

  /* Estimasi waktu */
  ctx.font = `500 24px "${assets.fontFamily}"`;
  ctx.fillText(COPY.imageTimeLabel, CARD_PADDING, cursorY);
  ctx.font = `700 48px "${assets.fontFamily}"`;
  ctx.fillText(data.estimatedTimeLabel, CARD_PADDING, cursorY + 62);

  /* Route silhouette, centered in the remaining space */
  const silhouetteArea = {
    x: CARD_PADDING,
    y: cursorY + 160,
    width: CARD_WIDTH - CARD_PADDING * 2,
    height: CARD_HEIGHT - cursorY - 160 - 320,
  };
  const screenPoints = normalizeRouteSilhouette(data.geometry, silhouetteArea);
  drawRouteSilhouette(ctx, screenPoints);

  /* RideTopo wordmark near the bottom */
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `700 44px "${assets.fontFamily}"`;
  ctx.fillText(COPY.appName, CARD_PADDING, CARD_HEIGHT - 170);

  /* OSM attribution */
  ctx.font = `400 20px "${assets.fontFamily}"`;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(COPY.imageAttribution, CARD_PADDING, CARD_HEIGHT - CARD_PADDING);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Gagal membuat gambar."));
      }
    }, "image/png");
  });
}

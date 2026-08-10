import type { RouteCardData, RouteCardAssets } from "@/domain/export";

export async function renderRouteCard(
  data: RouteCardData,
  assets: RouteCardAssets,
): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const padding = 96;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia.");

  ctx.fillStyle = "#14201E";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 28px "${assets.fontFamily}", sans-serif`;
  ctx.fillText("RENCANA RUTE", padding, padding + 20);

  try {
    ctx.drawImage(assets.logo, padding, 60, 48, 48);
  } catch {
    // logo optional
  }

  ctx.font = `500 22px "${assets.fontFamily}", sans-serif`;
  ctx.fillText("Jarak", padding, padding + 120);
  ctx.font = `700 40px "${assets.fontFamily}", sans-serif`;
  ctx.fillText(data.distanceLabel, padding, padding + 170);

  if (data.elevationGainLabel) {
    ctx.font = `500 22px "${assets.fontFamily}", sans-serif`;
    ctx.fillText("Elevasi naik", padding, padding + 240);
    ctx.font = `700 40px "${assets.fontFamily}", sans-serif`;
    ctx.fillText(data.elevationGainLabel, padding, padding + 290);
  }

  ctx.font = `500 22px "${assets.fontFamily}", sans-serif`;
  ctx.fillText("Estimasi waktu", padding, data.elevationGainLabel ? padding + 360 : padding + 240);
  ctx.font = `700 40px "${assets.fontFamily}", sans-serif`;
  ctx.fillText(data.estimatedTimeLabel, padding, data.elevationGainLabel ? padding + 410 : padding + 290);

  if (data.geometry.length >= 2) {
    const chartY = 1000;
    const chartH = 200;
    const chartW = W - padding * 2;
    ctx.strokeStyle = "#2DD4BF";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();

    for (let i = 0; i < data.geometry.length; i++) {
      const x = padding + (i / (data.geometry.length - 1)) * chartW;
      const y = chartY + chartH * 0.5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.font = `400 18px "${assets.fontFamily}", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(
    "Route data \u00a9 OpenStreetMap contributors \u2014 openstreetmap.org/copyright",
    padding,
    H - 60,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      } else {
        reject(new Error("Gagal membuat gambar."));
      }
    }, "image/png");
  });
}

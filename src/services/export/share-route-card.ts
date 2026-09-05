export function canShareRouteCard(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

export async function shareRouteCard(file: File): Promise<void> {
  await navigator.share({
    files: [file],
    title: "RideTopo",
  });
}

export function downloadRouteCard(file: File, filename: string): void {
  triggerDownload(file, filename);
}

/**
 * Revoking the object URL in the same tick can cancel the download in Firefox
 * and WebKit, so release it on the next tick instead.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function generateImageFilename(route: { input: { locations: readonly { label: string }[] } }): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  const originLabel = route.input.locations[0]?.label ?? "asal";
  const destLabel = route.input.locations[route.input.locations.length - 1]?.label ?? "tujuan";
  return `ridetopo-rencana-${safeSlug(originLabel)}-${safeSlug(destLabel)}-${date}.png`;
}

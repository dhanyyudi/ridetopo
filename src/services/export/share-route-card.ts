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
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

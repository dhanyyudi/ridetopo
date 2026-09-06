/**
 * Reload a tab whose service worker has just been replaced.
 *
 * A new worker claims open tabs as soon as it activates, but the JavaScript
 * already running in them is the previous build. That bundle asks for its own
 * hashed chunks — GPX export, the image card, avoidance validation, MapLibre
 * itself are all loaded on demand — and those chunks are in neither the new
 * precache nor the current deployment. Without this, the tab keeps working
 * until someone presses Ekspor, and then that button is simply broken until
 * they reload by hand.
 *
 * The first install is not a replacement: there was no previous worker and
 * nothing stale to shed, so reloading then would only interrupt a first
 * visit for no reason.
 */
export function reloadOnWorkerReplacement(
  container: ServiceWorkerContainer | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.serviceWorker,
  reload: () => void = () => window.location.reload(),
): void {
  if (!container) return;

  const hadController = Boolean(container.controller);
  let reloading = false;

  container.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    reload();
  });
}

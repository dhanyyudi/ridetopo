import type { PlannedRoute } from "@/domain/route";
import { analyzeElevation, type AnalyzedElevation } from "@/domain/elevation";
import { combinedElevationSamples } from "./merge-legs";

/* One analysis per route object. React renders read this instead of
   recomputing the pipeline, and every consumer sees identical totals. */
const cache = new WeakMap<PlannedRoute, AnalyzedElevation>();

export function getRouteElevation(route: PlannedRoute): AnalyzedElevation {
  const cached = cache.get(route);
  if (cached) return cached;

  const analyzed = analyzeElevation(
    combinedElevationSamples(route),
    route.metrics.distanceMeters,
  );
  cache.set(route, analyzed);
  return analyzed;
}

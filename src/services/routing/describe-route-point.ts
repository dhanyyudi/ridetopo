import type { PlannedRoute } from "@/domain/route";
import { computeWindowGrade } from "@/domain/elevation";
import { formatDistance, formatElevation, formatPercentage } from "@/lib/format-id";
import { getRouteElevation } from "./route-elevation";

/**
 * One line about a point on the route: how far along it is, how high, and how
 * steep. Only what was actually measured — a gap in the profile says so
 * instead of guessing, and there is no per-point speed to report because the
 * router gives a duration for the ride, not for each metre of it.
 */
export function describeRouteAt(route: PlannedRoute, distanceMeters: number): string {
  const parts = [formatDistance(distanceMeters)];
  const { samples } = getRouteElevation(route);

  if (samples.length === 0) return parts.join(" · ");

  let nearest = 0;
  let nearestGap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length; i++) {
    const gap = Math.abs(samples[i]!.distanceMeters - distanceMeters);
    if (gap >= nearestGap) break;
    nearestGap = gap;
    nearest = i;
  }

  const elevation = samples[nearest]!.elevationMeters;
  if (elevation === null) return parts.join(" · ");

  parts.push(formatElevation(elevation));

  const grade = computeWindowGrade(samples, nearest);
  if (grade !== null) parts.push(formatPercentage(grade));

  return parts.join(" · ");
}

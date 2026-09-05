import { useMemo } from "react";
import type { RouteMetrics } from "@/domain/route";
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  formatClockTime,
} from "@/lib/format-id";
import { COPY } from "@/content/id";

interface Props {
  metrics: RouteMetrics;
  roundTrip: boolean;
  limitedReturn: boolean;
  /** Identifies the route, so the departure clock is fixed per result. */
  routeId?: string;
}

export function RouteSummary({ metrics, routeId }: Props) {
  const speed = formatSpeed(metrics.distanceMeters, metrics.durationSeconds);

  /* Anchored to when this result appeared rather than to every render, so the
     arrival time does not creep while you read it. */
  const schedule = useMemo(() => {
    if (!Number.isFinite(metrics.durationSeconds) || metrics.durationSeconds <= 0) return null;
    const departure = new Date();
    const arrival = new Date(departure.getTime() + metrics.durationSeconds * 1000);
    return { departure: formatClockTime(departure), arrival: formatClockTime(arrival) };
    /* routeId keys the memo: a new route means a new departure time. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, metrics.durationSeconds]);

  return (
    <>
      <div className="metrics-row">
        <div className="metric-block">
          <span className="metric-label">{COPY.routeDistance}</span>
          <span className="metric-value">{formatDistance(metrics.distanceMeters)}</span>
        </div>
        <div className="metric-block">
          <span className="metric-label">{COPY.routeDuration}</span>
          <span className="metric-value">{formatDuration(metrics.durationSeconds)}</span>
          <span className="metric-note">{COPY.durationDisclaimer}</span>
        </div>
      </div>

      {(speed || schedule) && (
        <div className="metrics-row">
          {speed && (
            <div className="metric-block">
              <span className="metric-label">{COPY.routeSpeed}</span>
              <span className="metric-value">{speed}</span>
            </div>
          )}
          {schedule && (
            <div className="metric-block">
              <span className="metric-label">{COPY.routeSchedule}</span>
              <span className="metric-value">
                {schedule.departure} → {schedule.arrival}
              </span>
              <span className="metric-note">
                {COPY.scheduleDepartNow}, {COPY.scheduleArrive} {schedule.arrival}.{" "}
                {COPY.scheduleDisclaimer}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

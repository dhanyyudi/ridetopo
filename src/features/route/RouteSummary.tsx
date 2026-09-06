import type { RouteMetrics } from "@/domain/route";
import { formatDistance, formatDuration, formatSpeed } from "@/lib/format-id";
import { buildSchedule } from "@/services/routing/route-schedule";
import { COPY } from "@/content/id";

interface Props {
  metrics: RouteMetrics;
  roundTrip: boolean;
  limitedReturn: boolean;
  /** Planned departure as "HH:MM"; null means leaving now. */
  departureTime: string | null;
  onDepartureTimeChange: (value: string | null) => void;
}

export function RouteSummary({ metrics, departureTime, onDepartureTimeChange }: Props) {
  const speed = formatSpeed(metrics.distanceMeters, metrics.durationSeconds);
  const schedule = buildSchedule(metrics.durationSeconds, departureTime);

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

      <div className="metrics-row">
        {speed && (
          <div className="metric-block">
            <span className="metric-label">{COPY.routeSpeed}</span>
            <span className="metric-value">{speed}</span>
          </div>
        )}

        <div className="metric-block">
          <label className="metric-label" htmlFor="departure-time">
            {COPY.scheduleDepartureLabel}
          </label>
          {/* Planning often happens the night before, so the hour is the
              rider's to choose rather than whatever time it is now. */}
          <input
            id="departure-time"
            type="time"
            className="text-input departure-input"
            value={departureTime ?? ""}
            onChange={(e) => onDepartureTimeChange(e.target.value || null)}
          />
          {schedule && (
            <span className="metric-note">
              {COPY.routeSchedule}: {schedule.departureLabel} → {schedule.arrivalLabel}
              {schedule.assumedNow ? ` (${COPY.scheduleDepartNowShort})` : ""}.{" "}
              {COPY.scheduleDisclaimer}
            </span>
          )}
          <span className="metric-note">{COPY.scheduleDepartureHelper}</span>
        </div>
      </div>
    </>
  );
}

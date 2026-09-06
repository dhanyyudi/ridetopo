import { useState } from "react";
import { COPY } from "@/content/id";
import { useRoutePlannerStore } from "@/store/route-planner-store";
import type { useRoutePlannerController } from "./use-route-planner-controller";
import type { PlannedRoute } from "@/domain/route";
import type { AnalyzedElevation } from "@/domain/elevation";
import { ElevationChart } from "@/features/elevation/ElevationChart";
import { ElevationSummary } from "@/features/elevation/ElevationSummary";
import { TerrainLegend } from "@/features/elevation/TerrainLegend";
import { formatDistance, formatDuration, formatSpeed } from "@/lib/format-id";
import { buildSchedule } from "@/services/routing/route-schedule";
import {
  Pencil,
  Download,
  Image as ImageIcon,
  Map as MapIcon,
  Mountain,
  X,
} from "lucide-react";

interface Props {
  route: PlannedRoute;
  elevation: AnalyzedElevation;
  controller: ReturnType<typeof useRoutePlannerController>;
  offline: boolean;
}

/**
 * The result on a phone: the map, and as little else as the job allows.
 *
 * The actions are icons on a rail rather than labelled buttons across the
 * bottom, and the numbers are chips the map shows through. Opening the chart
 * clears the rail away and leaves one control — the way out — because
 * nothing else is worth doing while the chart is what you are reading.
 */
export function RouteResultCompact({
  route,
  elevation,
  controller,
  offline,
}: Props) {
  const store = useRoutePlannerStore();
  const [panel, setPanel] = useState<"elevation" | "export" | null>(null);

  const metrics = route.metrics;
  const speed = formatSpeed(metrics.distanceMeters, metrics.durationSeconds);
  const schedule = buildSchedule(metrics.durationSeconds, store.departureTime);

  /* The view still needs a name even when nothing on screen shows one: a
     screen reader lands here with no other way to know where "here" is. */
  const heading = <h1 className="sr-only">{COPY.resultTitle}</h1>;

  /* The chips sit at the bottom, out of the way — until the chart takes the
     bottom, and then they move up rather than being covered by it. */
  const stats = (
    <div className="overlay-chips">
      {/* The chip shows the number alone; the name is still said aloud, so a
          screen reader does not read three bare quantities in a row. */}
      <span className="glass chip">
        <span className="sr-only">{COPY.routeDistance}: </span>
        {formatDistance(metrics.distanceMeters)}
      </span>
      <span className="glass chip">
        <span className="sr-only">{COPY.routeDuration}: </span>
        {formatDuration(metrics.durationSeconds)}
      </span>
      {speed && (
        <span className="glass chip">
          <span className="sr-only">{COPY.routeSpeed}: </span>
          {speed}
        </span>
      )}
      <span className="glass chip chip-time">
        <label className="sr-only" htmlFor="departure-time">
          {COPY.scheduleDepartureLabel}
        </label>
        <input
          id="departure-time"
          type="time"
          className="chip-time-input"
          value={store.departureTime ?? ""}
          onChange={(e) => store.setDepartureTime(e.target.value || null)}
        />
        {schedule && (
          <span className="chip-arrival">→ {schedule.arrivalLabel}</span>
        )}
      </span>
    </div>
  );

  const closeButton = (label: string) => (
    <button
      type="button"
      className="glass icon-round overlay-close"
      onClick={() => setPanel(null)}
      aria-label={label}
      title={label}
    >
      <X size={20} aria-hidden="true" />
    </button>
  );

  if (panel === "elevation") {
    return (
      <div className="map-overlay overlay-open">
        <div className="overlay-head">
          {heading}
          {stats}
        </div>
        <section
          className="glass overlay-panel"
          aria-labelledby="elevation-heading"
        >
          <div className="overlay-panel-head">
            <h2 id="elevation-heading" className="section-title">
              {COPY.elevationSectionTitle}
            </h2>
            {closeButton(COPY.hideElevation)}
          </div>
          <ElevationSummary elevation={elevation} />
          <ElevationChart
            samples={elevation.samples}
            terrain={elevation.terrain}
            height={140}
            cursor={store.chartCursorMeters}
            onCursorChange={store.setChartCursorMeters}
          />
          {/* Terrain must never be read from colour alone. */}
          <TerrainLegend />
        </section>
      </div>
    );
  }

  if (panel === "export") {
    return (
      <div className="map-overlay overlay-open">
        <div className="overlay-head">
          {heading}
          {stats}
        </div>
        <section className="glass overlay-panel">
          <div className="overlay-panel-head">
            <h2 className="section-title">{COPY.exportTitle}</h2>
            {closeButton(COPY.hideExport)}
          </div>
          <div className="export-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={controller.exportGpx}
            >
              <Download size={16} aria-hidden="true" />
              {COPY.gpxDownload}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void controller.prepareImage()}
            >
              <ImageIcon size={16} aria-hidden="true" />
              {COPY.shareImage}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="map-overlay">
      {heading}
      <div className="overlay-rail">
        <button
          type="button"
          className="glass icon-round"
          onClick={() => setPanel("elevation")}
          aria-label={COPY.showElevation}
          title={COPY.showElevation}
        >
          <Mountain size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="glass icon-round"
          onClick={() => void controller.openRoadReview()}
          disabled={offline}
          aria-label={COPY.roadReview}
          title={COPY.roadReview}
        >
          <MapIcon size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="glass icon-round"
          onClick={() => setPanel("export")}
          aria-label={COPY.exportTitle}
          title={COPY.exportTitle}
        >
          <Download size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="glass icon-round"
          onClick={() => store.setAppView("composer")}
          aria-label={COPY.editRoute}
          title={COPY.editRoute}
        >
          <Pencil size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="overlay-foot">
        {route.input.returnToStart && (
          <p className="glass chip overlay-note" role="status">
            {route.limitedReturnAlternatives
              ? COPY.limitedReturn
              : COPY.returnHelper}
          </p>
        )}
        {stats}
      </div>
    </div>
  );
}

import { COPY } from "@/content/id";
import { useRoutePlannerStore } from "@/store/route-planner-store";
import type { useRoutePlannerController } from "./use-route-planner-controller";
import { getRouteElevation } from "@/services/routing/route-elevation";
import { ElevationChart } from "@/features/elevation/ElevationChart";
import { ElevationSummary } from "@/features/elevation/ElevationSummary";
import { RouteSummary } from "./RouteSummary";
import { Pencil, Download, Image as ImageIcon, Map as MapIcon } from "lucide-react";

interface Props {
  controller: ReturnType<typeof useRoutePlannerController>;
  offline: boolean;
}

export function RouteResultPanel({ controller, offline }: Props) {
  const store = useRoutePlannerStore();
  const route = store.lastValidRoute;

  if (!route) return null;

  /* Shared, cached analysis: the return leg's samples are shifted onto the
     combined distance axis, so the panel and the exports agree. */
  const elevation = getRouteElevation(route);

  return (
    <div className="result-panel">
      <div className="result-scroll">
        <div className="result-header">
          <h1 className="result-title">{COPY.resultTitle}</h1>
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={() => store.setAppView("composer")}
            aria-label={COPY.editRoute}
          >
            <Pencil size={16} aria-hidden="true" />
            {COPY.editRoute}
          </button>
        </div>

        <RouteSummary
          metrics={route.metrics}
          roundTrip={route.input.returnToStart}
          limitedReturn={route.limitedReturnAlternatives}
        />

        {route.input.returnToStart && (
          <p className="result-roundtrip-status" role="status">
            {route.limitedReturnAlternatives ? COPY.limitedReturn : COPY.returnHelper}
          </p>
        )}

        {elevation && (
          <section className="result-section" aria-labelledby="elevation-heading">
            <h2 id="elevation-heading" className="section-title">
              {COPY.elevationGain}
            </h2>
            <ElevationSummary elevation={elevation} />
            <div className="chart-host">
              <ElevationChart samples={elevation.samples} terrain={elevation.terrain} height={190} />
            </div>
          </section>
        )}

        <section className="result-section">
          <button
            type="button"
            className="btn btn-secondary wide"
            onClick={() => void controller.openRoadReview()}
            disabled={offline}
          >
            <MapIcon size={18} aria-hidden="true" />
            {COPY.roadReview}
          </button>
        </section>

        <section className="result-section" aria-labelledby="export-heading">
          <h2 id="export-heading" className="section-title">
            {COPY.exportTitle}
          </h2>
          <div className="export-actions">
            <button type="button" className="btn btn-secondary" onClick={controller.exportGpx}>
              <Download size={16} aria-hidden="true" />
              {COPY.gpxDownload}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void controller.prepareImage()}>
              <ImageIcon size={16} aria-hidden="true" />
              {COPY.shareImage}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

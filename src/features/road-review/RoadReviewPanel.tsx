import { useState, useMemo, useCallback, useEffect } from "react";
import { COPY } from "@/content/id";
import { useRoutePlannerStore } from "@/store/route-planner-store";
import type { useRoutePlannerController } from "@/features/route/use-route-planner-controller";
import { PRODUCT_LIMITS } from "@/domain/route";
import type { Position } from "@/domain/geo";
import { getRoadDisplayName } from "@/domain/road";
import { formatDistance } from "@/lib/format-id";
import { cumulativeDistances } from "@/services/routing/calculate-overlap";
import { buildMultiEdgeExclusions } from "@/services/avoidance/build-exclusions";
import {
  buildSegmentRanges,
  segmentsWithinBounds,
  advanceCorridor,
  corridorRange,
} from "@/services/road/segment-ranges";
import {
  buildSegmentRuns,
  findRunBySegmentId,
  type SegmentRun,
} from "@/services/road/segment-runs";
import { Check, Ban, Minus } from "lucide-react";

interface Props {
  controller: ReturnType<typeof useRoutePlannerController>;
  onExit: () => void;
}

export function RoadReviewPanel({ controller, onExit }: Props) {
  const store = useRoutePlannerStore();
  const [avoiding, setAvoiding] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const route = store.lastValidRoute;
  const segments = useMemo(
    () => store.roadSegments ?? [],
    [store.roadSegments],
  );

  /* Trace and avoidance both run against the whole route, round trips
     included, so every distance here comes from the combined geometry. */
  const geometry = useMemo(() => route?.geometry ?? [], [route]);
  const cumulative = useMemo(() => cumulativeDistances(geometry), [geometry]);
  const ranges = useMemo(
    () => buildSegmentRanges(segments, cumulative),
    [segments, cumulative],
  );
  const rangeById = useMemo(
    () => new Map(ranges.map((range) => [range.id, range])),
    [ranges],
  );
  /* One row per stretch of road, not per graph edge — see segment-runs. */
  const runs = useMemo(
    () => buildSegmentRuns(segments, rangeById),
    [segments, rangeById],
  );

  const {
    reviewSelection,
    reviewCorridor,
    setReviewSelection,
    setReviewCorridor,
  } = store;
  const corridorMode = reviewCorridor !== null;

  const selectedRun = useMemo(() => {
    if (corridorMode) return null;
    const first = reviewSelection?.segmentIds[0];
    return first ? findRunBySegmentId(runs, first) : null;
  }, [corridorMode, reviewSelection, runs]);

  /* Leaving review clears the highlight so the result map is clean again. */
  useEffect(
    () => () => {
      setReviewSelection(null);
      setReviewCorridor(null);
    },
    [setReviewSelection, setReviewCorridor],
  );

  const handleSelectRun = useCallback(
    (run: SegmentRun) => {
      if (selectedRun?.id === run.id) {
        setReviewSelection(null);
        return;
      }
      setReviewSelection({
        startShapeIndex: run.startShapeIndex,
        endShapeIndex: run.endShapeIndex,
        segmentIds: run.segments.map((s) => s.id),
      });
    },
    [selectedRun, setReviewSelection],
  );

  const startCorridor = useCallback(() => {
    if (!selectedRun) return;
    setReviewCorridor({ startShapeIndex: null, endShapeIndex: null });
    setReviewSelection(null);
    setReviewError(null);
  }, [selectedRun, setReviewCorridor, setReviewSelection]);

  const cancelCorridor = useCallback(() => {
    setReviewCorridor(null);
    setReviewSelection(null);
  }, [setReviewCorridor, setReviewSelection]);

  const markBoundary = useCallback(
    (segmentId: string) => {
      const seg = segments.find((s) => s.id === segmentId);
      if (!seg || !reviewCorridor) return;

      const next = advanceCorridor(reviewCorridor, seg);
      setReviewCorridor(next);

      const bounds = corridorRange(next);
      setReviewSelection(
        bounds
          ? {
              startShapeIndex: bounds.start,
              endShapeIndex: bounds.end,
              segmentIds: segmentsWithinBounds(
                segments,
                bounds.start,
                bounds.end,
              ).map((s) => s.id),
            }
          : null,
      );
    },
    [segments, reviewCorridor, setReviewCorridor, setReviewSelection],
  );

  const applyAvoidance = useCallback(async () => {
    if (!route) return;
    setAvoiding(true);
    setReviewError(null);

    /* The selection already carries its own span, so a whole stretch of road
       is avoided end to end rather than only the edge that was tapped. */
    const bounds = reviewCorridor
      ? corridorRange(reviewCorridor)
      : reviewSelection
        ? {
            start: reviewSelection.startShapeIndex,
            end: reviewSelection.endShapeIndex,
          }
        : null;

    if (!bounds) {
      setAvoiding(false);
      setReviewError(COPY.reviewHint);
      return;
    }

    const edgeSegments = segmentsWithinBounds(
      segments,
      bounds.start,
      bounds.end,
    );
    if (edgeSegments.length === 0) {
      setAvoiding(false);
      setReviewError(COPY.reviewHint);
      return;
    }

    /* Deduplicated and evenly downsampled to the server budget, never
       truncated: a long corridor must stay avoided end to end. */
    const positions = buildMultiEdgeExclusions(edgeSegments, geometry, []);

    const avoidedGeometry: Position[] = geometry.slice(
      Math.max(0, bounds.start),
      Math.min(geometry.length, bounds.end + 1),
    ) as Position[];

    /* One name per road, not one per graph edge: a single street spanning
       eight edges read as its own name eight times over. */
    const label = edgeSegments
      .map(getRoadDisplayName)
      .filter((name, i, all) => name !== all[i - 1])
      .join(", ");

    await controller.addAvoidance(positions, label, avoidedGeometry);

    setAvoiding(false);
    setReviewSelection(null);
    setReviewCorridor(null);
  }, [
    route,
    segments,
    geometry,
    reviewSelection,
    reviewCorridor,
    controller,
    setReviewSelection,
    setReviewCorridor,
  ]);

  if (!route) return null;

  const bounds = reviewCorridor ? corridorRange(reviewCorridor) : null;
  const corridorLabel = (() => {
    if (!reviewCorridor || reviewCorridor.startShapeIndex == null)
      return COPY.corridorStart;
    const startMeters =
      cumulative[
        Math.min(reviewCorridor.startShapeIndex, cumulative.length - 1)
      ] ?? 0;
    if (!bounds) {
      return `${COPY.corridorStart}: ${formatDistance(startMeters)} — ${COPY.corridorEnd}`;
    }
    const from = cumulative[Math.min(bounds.start, cumulative.length - 1)] ?? 0;
    const to = cumulative[Math.min(bounds.end, cumulative.length - 1)] ?? 0;
    return `${COPY.corridorRange}: ${formatDistance(from)}–${formatDistance(to)}`;
  })();

  return (
    <div className="review-panel">
      <div className="review-scroll">
        <div className="review-header">
          <h1 className="result-title">{COPY.roadReviewTitle}</h1>
          <button type="button" className="btn btn-tertiary" onClick={onExit}>
            <Check size={16} aria-hidden="true" />
            {COPY.exitReview}
          </button>
        </div>

        {store.roadSegmentsLoading && (
          <p className="inline-hint" role="status">
            {COPY.loading}
          </p>
        )}

        {store.roadMetadataError && (
          <p className="inline-error" role="alert">
            {store.roadMetadataError}
          </p>
        )}

        {!store.roadSegmentsLoading &&
          !store.roadMetadataError &&
          segments.length === 0 && (
            <p className="inline-hint">{COPY.metadataUnavailable}</p>
          )}

        <p className="section-helper">
          {corridorMode ? COPY.corridorHint : COPY.reviewHint}
        </p>

        <div
          className="segment-list"
          role="listbox"
          aria-label={COPY.roadReviewTitle}
        >
          {runs.map((run) => {
            const isSelected = selectedRun?.id === run.id;

            return (
              <button
                key={run.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`segment-item ${isSelected ? "selected" : ""}`}
                onClick={() =>
                  corridorMode
                    ? markBoundary(run.segments[0]!.id)
                    : handleSelectRun(run)
                }
              >
                <span className="segment-item-name">{run.name}</span>
                <span className="segment-item-detail">
                  {formatDistance(run.startMeters)}–
                  {formatDistance(run.endMeters)} · {run.descriptor}
                </span>
              </button>
            );
          })}
        </div>

        {store.activeExclusions.length > 0 && (
          <section aria-labelledby="exclusions-heading">
            <h2 id="exclusions-heading" className="section-title">
              {COPY.activeExclusions}
            </h2>
            {store.activeExclusions.length >=
              PRODUCT_LIMITS.maxExclusionLocations && (
              <p className="inline-hint">{COPY.maxExclusionsReached}</p>
            )}
            <div className="exclusion-list">
              {store.activeExclusions.map((ex) => (
                <div key={ex.id} className="exclusion-item">
                  <span className="exclusion-item-label">{ex.label}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => controller.removeAvoidance(ex.id)}
                    aria-label={`${COPY.removeExclusion}: ${ex.label}`}
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Outside the scroll on purpose: acting on a ruas must not require
          scrolling past the list you just picked it from. */}
      <div className="review-footer">
        {corridorMode && (
          <div className="segment-detail-panel">
            <p className="segment-detail-meta">{corridorLabel}</p>
            <div className="segment-detail-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void applyAvoidance()}
                disabled={avoiding || bounds === null}
              >
                {COPY.applyAvoidance}
              </button>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={cancelCorridor}
              >
                {COPY.cancelAvoidance}
              </button>
            </div>
          </div>
        )}
        {!corridorMode && selectedRun && (
          <div className="segment-detail-panel">
            <div>
              <div className="segment-detail-name">{selectedRun.name}</div>
              <div className="segment-detail-meta">
                {formatDistance(selectedRun.startMeters)}–
                {formatDistance(selectedRun.endMeters)} ·{" "}
                {selectedRun.descriptor}
              </div>
            </div>
            <div className="segment-detail-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void applyAvoidance()}
                disabled={avoiding}
              >
                <Ban size={16} aria-hidden="true" />
                {COPY.avoidRoad}
              </button>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={startCorridor}
              >
                {COPY.extendArea}
              </button>
            </div>
          </div>
        )}
        {reviewError && (
          <p className="inline-error" role="alert">
            {reviewError}
          </p>
        )}
        {store.routeError && (
          <p className="inline-error" role="alert">
            {store.routeError}
          </p>
        )}
      </div>
    </div>
  );
}

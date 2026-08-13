import { useState, useMemo, useCallback } from "react";
import { COPY } from "@/content/id";
import { useRoutePlannerStore } from "@/store/route-planner-store";
import type { useRoutePlannerController } from "@/features/route/use-route-planner-controller";
import type { RoadSegment } from "@/domain/route";
import type { Position } from "@/domain/geo";
import { getRoadDisplayName, getRoadClassDescription, getSurfaceLabel } from "@/domain/road";
import { formatDistance } from "@/lib/format-id";
import { Check, Ban, Minus } from "lucide-react";

interface Props {
  controller: ReturnType<typeof useRoutePlannerController>;
  onExit: () => void;
}

export function RoadReviewPanel({ controller, onExit }: Props) {
  const store = useRoutePlannerStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [corridorMode, setCorridorMode] = useState(false);
  const [corridorStart, setCorridorStart] = useState<number | null>(null);
  const [corridorEnd, setCorridorEnd] = useState<number | null>(null);
  const [avoiding, setAvoiding] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const route = store.lastValidRoute;
  const segments = useMemo(() => store.roadSegments ?? [], [store.roadSegments]);

  const selected = useMemo(
    () => segments.find((s) => s.id === selectedId) ?? null,
    [segments, selectedId],
  );

  const routeLength = route?.metrics.distanceMeters ?? 0;

  const handleSelect = useCallback((seg: RoadSegment) => {
    setSelectedId((prev) => (prev === seg.id ? null : seg.id));
  }, []);

  const corridorRange = useCallback((): { start: number; end: number } | null => {
    if (corridorStart == null || corridorEnd == null) return null;
    return {
      start: Math.min(corridorStart, corridorEnd),
      end: Math.max(corridorStart, corridorEnd),
    };
  }, [corridorStart, corridorEnd]);

  const startCorridor = useCallback(() => {
    if (!selected) return;
    setCorridorMode(true);
    setCorridorStart(null);
    setCorridorEnd(null);
    setReviewError(null);
  }, [selected]);

  const markBoundary = useCallback((segmentId: string) => {
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg) return;
    if (corridorStart == null) {
      setCorridorStart(seg.beginShapeIndex);
    } else {
      setCorridorEnd(seg.endShapeIndex);
    }
  }, [segments, corridorStart]);

  const applyAvoidance = useCallback(async () => {
    if (!route) return;
    setAvoiding(true);
    setReviewError(null);

    const bounds = corridorMode ? corridorRange() : selected
      ? { start: selected.beginShapeIndex, end: selected.endShapeIndex }
      : null;

    if (!bounds) {
      setAvoiding(false);
      setReviewError(COPY.reviewHint);
      return;
    }

    const edgeSegments = segments.filter((s) => {
      const mid = (s.beginShapeIndex + s.endShapeIndex) / 2;
      return mid >= bounds.start && mid <= bounds.end;
    });

    if (edgeSegments.length === 0) {
      setAvoiding(false);
      setReviewError(COPY.reviewHint);
      return;
    }

    const midpoints: Position[] = edgeSegments.map((seg) => {
      const midIdx = Math.floor((seg.beginShapeIndex + seg.endShapeIndex) / 2);
      const pt = route.outbound.geometry[Math.min(midIdx, route.outbound.geometry.length - 1)];
      return pt ?? route.outbound.geometry[route.outbound.geometry.length - 1]!;
    });

    const avoidedGeometry: Position[] = route.outbound.geometry.slice(
      Math.max(0, bounds.start),
      Math.min(route.outbound.geometry.length, bounds.end + 1),
    ) as Position[];

    await controller.addAvoidance(
      midpoints,
      edgeSegments.map(getRoadDisplayName).join(", "),
      avoidedGeometry,
    );

    setAvoiding(false);
    setSelectedId(null);
    setCorridorMode(false);
    setCorridorStart(null);
    setCorridorEnd(null);
  }, [route, segments, selected, corridorMode, controller, corridorRange]);

  if (!route) return null;

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

        {!store.roadSegmentsLoading && !store.roadMetadataError && segments.length === 0 && (
          <p className="inline-hint">{COPY.metadataUnavailable}</p>
        )}

        <p className="section-helper">
          {corridorMode ? COPY.corridorHint : COPY.reviewHint}
        </p>

        <div className="segment-list" role="listbox" aria-label={COPY.roadReviewTitle}>
          {segments.map((seg) => {
            const kmStart = (seg.beginShapeIndex / Math.max(1, route.outbound.geometry.length - 1)) * routeLength;
            const kmEnd = (seg.endShapeIndex / Math.max(1, route.outbound.geometry.length - 1)) * routeLength;
            const isSelected = selectedId === seg.id;

            return (
              <button
                key={seg.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`segment-item ${isSelected ? "selected" : ""}`}
                onClick={() => (corridorMode ? markBoundary(seg.id) : handleSelect(seg))}
              >
                <span className="segment-item-name">{getRoadDisplayName(seg)}</span>
                <span className="segment-item-detail">
                  {formatDistance(kmStart)}–{formatDistance(kmEnd)} · {getRoadClassDescription(seg)} · {getSurfaceLabel(seg)}
                </span>
              </button>
            );
          })}
        </div>

        {corridorMode && (
          <div className="segment-detail-panel">
            <p className="segment-detail-meta">
              {corridorStart == null
                ? COPY.corridorStart
                : corridorEnd == null
                  ? COPY.corridorEnd
                  : `${COPY.corridorStart}: ${corridorStart} — ${COPY.corridorEnd}: ${corridorEnd}`}
            </p>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="button" className="btn btn-secondary" onClick={() => void applyAvoidance()} disabled={avoiding || corridorStart == null || corridorEnd == null}>
                {COPY.applyAvoidance}
              </button>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => {
                  setCorridorMode(false);
                  setCorridorStart(null);
                  setCorridorEnd(null);
                }}
              >
                {COPY.cancelAvoidance}
              </button>
            </div>
          </div>
        )}

        {!corridorMode && selected && (
          <div className="segment-detail-panel">
            <div>
              <div className="segment-detail-name">{getRoadDisplayName(selected)}</div>
              <div className="segment-detail-meta">
                {getRoadClassDescription(selected)} · {getSurfaceLabel(selected)}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="button" className="btn btn-primary" onClick={() => void applyAvoidance()} disabled={avoiding}>
                <Ban size={16} aria-hidden="true" />
                {COPY.avoidRoad}
              </button>
              <button type="button" className="btn btn-tertiary" onClick={startCorridor}>
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

        {store.activeExclusions.length > 0 && (
          <section aria-labelledby="exclusions-heading">
            <h2 id="exclusions-heading" className="section-title">
              {COPY.activeExclusions}
            </h2>
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
    </div>
  );
}

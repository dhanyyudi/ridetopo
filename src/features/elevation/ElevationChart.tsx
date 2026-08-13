import { useEffect, useRef, useState } from "react";
import type { ElevationSample } from "@/domain/route";
import type { TerrainSection } from "@/domain/elevation";
import { COPY } from "@/content/id";
import { formatDistance, formatElevation } from "@/lib/format-id";

interface Props {
  samples: readonly ElevationSample[];
  terrain: readonly TerrainSection[];
  height?: number;
  cursor?: number | null;
  onCursorChange?: (distanceMeters: number) => void;
}

const PADDING = { top: 16, right: 12, bottom: 26, left: 44 };

export function ElevationChart({ samples, terrain, height = 190, cursor, onCursorChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(220, entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartW = Math.max(100, width - PADDING.left - PADDING.right);
  const chartH = Math.max(60, height - PADDING.top - PADDING.bottom);

  if (samples.length < 2) {
    return (
      <div className="chart-empty" style={{ height }} ref={containerRef}>
        {COPY.elevationUnavailable}
      </div>
    );
  }

  const validElevations = samples
    .filter((s) => s.elevationMeters !== null)
    .map((s) => s.elevationMeters as number);

  if (validElevations.length === 0) {
    return (
      <div className="chart-empty" style={{ height }} ref={containerRef}>
        {COPY.elevationUnavailable}
      </div>
    );
  }

  const minElev = Math.min(...validElevations);
  const maxElev = Math.max(...validElevations);
  const elevRange = maxElev - minElev || 1;
  const maxDist = samples[samples.length - 1]!.distanceMeters || 1;
  const distScale = chartW / maxDist;
  const elevScale = chartH / elevRange;

  const toX = (d: number) => PADDING.left + d * distScale;
  const toY = (e: number) => PADDING.top + chartH - (e - minElev) * elevScale;

  /* Broken path segments across null gaps */
  const segments: string[] = [];
  let current: string[] = [];
  for (const s of samples) {
    if (s.elevationMeters === null) {
      if (current.length >= 2) segments.push(`M${current.join(" L")}`);
      current = [];
      continue;
    }
    current.push(`${toX(s.distanceMeters).toFixed(1)},${toY(s.elevationMeters).toFixed(1)}`);
  }
  if (current.length >= 2) segments.push(`M${current.join(" L")}`);

  const terrainBands = terrain.map((section, idx) => {
    const x1 = toX(section.startDistanceMeters);
    const x2 = toX(section.endDistanceMeters);
    const color =
      section.classification === "climb"
        ? "#D97706"
        : section.classification === "descent"
          ? "#2563EB"
          : "#0F766E";
    return (
      <rect
        key={idx}
        x={x1}
        y={PADDING.top}
        width={Math.max(1.5, x2 - x1)}
        height={chartH}
        fill={color}
        opacity={0.12}
      />
    );
  });

  const yTicks = [maxElev, minElev + (maxElev - minElev) / 2, minElev].map((v, i) => (
    <g key={i}>
      <line x1={PADDING.left} x2={PADDING.left + chartW} y1={toY(v)} y2={toY(v)} stroke="#D8E2DF" strokeWidth={1} />
      <text
        x={PADDING.left - 6}
        y={toY(v) + 4}
        textAnchor="end"
        fontSize={10}
        fill="#65736F"
        aria-hidden="true"
      >
        {Math.round(v)}
      </text>
    </g>
  ));

  const xTicks = Math.min(5, Math.floor(chartW / 70) + 1);
  const xTickMarks = Array.from({ length: xTicks }, (_, i) => {
    const d = (maxDist * i) / (xTicks - 1 || 1);
    return (
      <text
        key={i}
        x={toX(d)}
        y={height - 6}
        textAnchor="middle"
        fontSize={10}
        fill="#65736F"
        aria-hidden="true"
      >
        {formatDistance(d).replace(" km", "")}
      </text>
    );
  });

  const cursorX = cursor != null ? toX(cursor) : null;
  const cursorSample = cursor != null ? findSampleAt(samples, cursor) : null;

  const handlePointer = (clientX: number) => {
    if (!onCursorChange) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left - PADDING.left;
    const dist = Math.max(0, Math.min(maxDist, x / distScale));
    onCursorChange(dist);
  };

  return (
    <div
      ref={containerRef}
      className="elevation-chart"
      role="img"
      aria-label={COPY.elevationChartLabel}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onClick={(e) => handlePointer(e.clientX)}
        onKeyDown={(e) => {
          if (!onCursorChange) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const step = (e.key === "ArrowRight" ? 1 : -1) * 500;
            const next = Math.max(0, Math.min(maxDist, (cursor ?? 0) + step));
            onCursorChange(next);
          }
        }}
        tabIndex={onCursorChange ? 0 : undefined}
        style={{ touchAction: "pan-y" }}
      >
        {terrainBands}
        {yTicks}
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#0F766E"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {cursorX != null && (
          <line
            x1={cursorX}
            y1={PADDING.top}
            x2={cursorX}
            y2={PADDING.top + chartH}
            stroke="#2DD4BF"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}
        {xTickMarks}
      </svg>
      {cursorSample && (
        <p className="chart-cursor-label" aria-live="polite">
          {formatDistance(cursorSample.distanceMeters)} —{" "}
          {cursorSample.elevationMeters != null
            ? formatElevation(cursorSample.elevationMeters)
            : COPY.elevationUnavailable}
        </p>
      )}
    </div>
  );
}

function findSampleAt(
  samples: readonly ElevationSample[],
  distance: number,
): ElevationSample | null {
  let best: ElevationSample | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const s of samples) {
    const diff = Math.abs(s.distanceMeters - distance);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

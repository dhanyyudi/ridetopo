import { useEffect, useRef, useState } from "react";
import type { ElevationSample } from "@/domain/route";
import type { TerrainSection, TerrainClass } from "@/domain/elevation";
import { COPY } from "@/content/id";
import { formatDistance, formatElevation } from "@/lib/format-id";
import { TERRAIN_COLORS } from "@/features/map/map-layers";

interface Props {
  samples: readonly ElevationSample[];
  terrain: readonly TerrainSection[];
  height?: number;
  cursor?: number | null;
  onCursorChange?: (distanceMeters: number) => void;
}

const PADDING = { top: 16, right: 12, bottom: 26, left: 44 };

export function ElevationChart({ samples, terrain, height = 220, cursor, onCursorChange }: Props) {
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

  /* Reduced, not spread: a 500 km profile has tens of thousands of samples
     and Math.min(...array) blows the argument limit. */
  let minElev = Number.POSITIVE_INFINITY;
  let maxElev = Number.NEGATIVE_INFINITY;
  let validCount = 0;
  for (const sample of samples) {
    if (sample.elevationMeters === null) continue;
    validCount++;
    if (sample.elevationMeters < minElev) minElev = sample.elevationMeters;
    if (sample.elevationMeters > maxElev) maxElev = sample.elevationMeters;
  }

  if (validCount === 0) {
    return (
      <div className="chart-empty" style={{ height }} ref={containerRef}>
        {COPY.elevationUnavailable}
      </div>
    );
  }
  const elevRange = maxElev - minElev || 1;
  const maxDist = samples[samples.length - 1]!.distanceMeters || 1;
  const distScale = chartW / maxDist;
  const elevScale = chartH / elevRange;

  const toX = (d: number) => PADDING.left + d * distScale;
  const toY = (e: number) => PADDING.top + chartH - (e - minElev) * elevScale;

  /* The line carries the terrain colour itself. A tinted band behind a plain
     teal line left people guessing which stretch was which. */
  const classAt = (distanceMeters: number): TerrainClass | null => {
    for (const section of terrain) {
      if (
        distanceMeters >= section.startDistanceMeters &&
        distanceMeters <= section.endDistanceMeters
      ) {
        return section.classification;
      }
    }
    return null;
  };

  const segments: { d: string; color: string }[] = [];
  let current: string[] = [];
  let currentClass: TerrainClass | null = null;

  const flush = () => {
    if (current.length >= 2) {
      segments.push({
        d: `M${current.join(" L")}`,
        color: TERRAIN_COLORS[currentClass ?? "flat"],
      });
    }
    current = [];
  };

  for (const s of samples) {
    if (s.elevationMeters === null) {
      flush();
      currentClass = null;
      continue;
    }
    const point = `${toX(s.distanceMeters).toFixed(1)},${toY(s.elevationMeters).toFixed(1)}`;
    const sampleClass = classAt(s.distanceMeters);

    if (current.length > 0 && sampleClass !== currentClass) {
      /* Carry the joint into the next run so the line has no gaps. */
      const joint = current[current.length - 1]!;
      flush();
      current = [joint];
    }
    currentClass = sampleClass;
    current.push(point);
  }
  flush();

  const terrainBands = terrain.map((section, idx) => {
    const x1 = toX(section.startDistanceMeters);
    const x2 = toX(section.endDistanceMeters);
    const color = TERRAIN_COLORS[section.classification ?? "flat"];
    return (
      <rect
        key={idx}
        x={x1}
        y={PADDING.top}
        width={Math.max(1.5, x2 - x1)}
        height={chartH}
        fill={color}
        opacity={0.08}
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

  const cursorText = cursorSample
    ? `${formatDistance(cursorSample.distanceMeters)} — ${
        cursorSample.elevationMeters != null
          ? formatElevation(cursorSample.elevationMeters)
          : COPY.elevationUnavailable
      }`
    : COPY.elevationChartLabel;

  /* Interactive: a slider along the route. Static: just a picture. */
  const interactiveProps = onCursorChange
    ? {
        role: "slider",
        tabIndex: 0,
        "aria-label": COPY.elevationChartLabel,
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(maxDist),
        "aria-valuenow": Math.round(cursor ?? 0),
        "aria-valuetext": cursorText,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const step = (e.key === "ArrowRight" ? 1 : -1) * Math.max(50, maxDist / 40);
          onCursorChange(Math.max(0, Math.min(maxDist, (cursor ?? 0) + step)));
        },
        onClick: (e: React.MouseEvent) => handlePointer(e.clientX),
        /* Plain hover, no button held: reading the profile should not require
           dragging it. Touch only emits pointermove while a finger is down,
           so the same handler serves both. */
        onPointerMove: (e: React.PointerEvent) => handlePointer(e.clientX),
      }
    : { role: "img", "aria-label": COPY.elevationChartLabel };

  return (
    <div
      ref={containerRef}
      className="elevation-chart"
      style={{ touchAction: "pan-y" }}
      {...interactiveProps}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {terrainBands}
        {yTicks}
        {segments.map((segment, i) => (
          <path
            key={i}
            d={segment.d}
            fill="none"
            stroke={segment.color}
            strokeWidth={3}
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
      {onCursorChange && !cursorSample && (
        <p className="chart-hint">{COPY.elevationChartHint}</p>
      )}
      {cursorSample && (
        <p className="chart-cursor-label" aria-live="polite">
          {cursorText}
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

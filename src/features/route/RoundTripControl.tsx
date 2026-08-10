import { COPY } from "@/content/id";
import type { ReturnMode } from "@/domain/route";

interface Props {
  enabled: boolean;
  mode: ReturnMode;
  onToggle: (enabled: boolean) => void;
  onModeChange: (mode: ReturnMode) => void;
}

export function RoundTripControl({ enabled, mode, onToggle, onModeChange }: Props) {
  return (
    <div style={{
      padding: "var(--space-3) var(--space-4)",
      background: "var(--color-surface-alt)",
      borderRadius: "var(--radius-md)",
    }}>
      <label style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: "var(--text-sm)",
      }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ width: "20px", height: "20px", accentColor: "var(--color-primary)" }}
        />
        {COPY.returnToStart}
      </label>

      {enabled && (
        <div style={{ marginTop: "var(--space-3)", paddingLeft: "var(--space-8)" }}>
          <label className="field-label">{COPY.returnMode}</label>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
            <button
              onClick={() => onModeChange("different-road")}
              className={mode === "different-road" ? "btn btn-primary" : "btn btn-secondary"}
              style={{ flex: 1, fontSize: "var(--text-xs)" }}
            >
              {COPY.returnDifferentRoad}
            </button>
            <button
              onClick={() => onModeChange("fastest")}
              className={mode === "fastest" ? "btn btn-primary" : "btn btn-secondary"}
              style={{ flex: 1, fontSize: "var(--text-xs)" }}
            >
              {COPY.returnFastest}
            </button>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", marginTop: "var(--space-2)" }}>
            {mode === "different-road" ? COPY.returnHelper : COPY.returnFastestHelper}
          </p>
        </div>
      )}
    </div>
  );
}

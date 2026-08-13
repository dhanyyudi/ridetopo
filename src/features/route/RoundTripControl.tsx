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
    <div className="roundtrip-control">
      <label className="roundtrip-toggle-row">
        <input
          type="checkbox"
          className="roundtrip-switch"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="roundtrip-label">{COPY.returnToStart}</span>
      </label>

      {enabled && (
        <div className="roundtrip-details">
          <span className="roundtrip-return-label">{COPY.returnMode}</span>
          <div className="segmented" role="radiogroup" aria-label={COPY.returnMode}>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "different-road"}
              className={mode === "different-road" ? "segmented-item active" : "segmented-item"}
              onClick={() => onModeChange("different-road")}
            >
              {COPY.returnDifferentRoad}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "fastest"}
              className={mode === "fastest" ? "segmented-item active" : "segmented-item"}
              onClick={() => onModeChange("fastest")}
            >
              {COPY.returnFastest}
            </button>
          </div>
          <p className="section-helper">
            {mode === "different-road" ? COPY.returnHelper : COPY.returnFastestHelper}
          </p>
        </div>
      )}
    </div>
  );
}

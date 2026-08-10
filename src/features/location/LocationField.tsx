import { COPY } from "@/content/id";
import type { RouteLocation } from "@/domain/location";

interface Props {
  location: RouteLocation;
  index: number;
  total: number;
  onRemove: () => void;
  onOpenSearch: () => void;
  onOpenMapPicker: () => void;
  onUseGeolocation: () => void;
}

export function LocationField({ location, index, total, onRemove, onOpenSearch, onOpenMapPicker, onUseGeolocation }: Props) {
  const isOrigin = location.role === "origin";
  const isDestination = location.role === "destination";

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        padding: "0.75rem",
        background: "var(--color-white)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: isOrigin
            ? "var(--color-primary)"
            : isDestination
              ? "var(--color-climb)"
              : "var(--color-text-secondary)",
          color: "white",
          fontSize: "var(--text-xs)",
          fontWeight: 700,
        }}
      >
        {isOrigin ? "A" : isDestination ? "B" : index}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <label className="field-label" style={{ marginBottom: 0 }}>
          {isOrigin ? COPY.startPoint : isDestination ? COPY.destination : `${COPY.waypointLabel} ${index}`}
        </label>
        <div
          role="button"
          tabIndex={0}
          onClick={onOpenSearch}
          onKeyDown={(e) => e.key === "Enter" && onOpenSearch()}
          style={{
            padding: "0.5rem",
            color: location.label !== "" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {location.label || COPY.searchPlaceholder}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
        <button
          onClick={onOpenMapPicker}
          className="btn btn-ghost"
          style={{ padding: "0.25rem", minWidth: "32px", minHeight: "32px" }}
          title={COPY.pickOnMap}
          aria-label={COPY.pickOnMap}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
        </button>

        {isOrigin && (
          <button
            onClick={onUseGeolocation}
            className="btn btn-ghost"
            style={{ padding: "0.25rem", minWidth: "32px", minHeight: "32px" }}
            title={COPY.myLocation}
            aria-label={COPY.myLocation}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
          </button>
        )}

        {total > 2 && (
          <button
            onClick={onRemove}
            className="btn btn-ghost"
            style={{ padding: "0.25rem", minWidth: "32px", minHeight: "32px", color: "var(--color-error)" }}
            title={COPY.removeWaypoint}
            aria-label={`${COPY.removeWaypoint}: ${isOrigin ? "A" : isDestination ? "B" : index}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

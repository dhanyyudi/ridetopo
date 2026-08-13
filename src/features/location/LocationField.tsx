import { COPY } from "@/content/id";
import type { EditableRouteLocation } from "@/domain/location";
import { MapPin, Search, LocateFixed, X, ChevronUp, ChevronDown } from "lucide-react";

interface Props {
  location: EditableRouteLocation;
  waypointIndex: number;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpenSearch: () => void;
  onOpenMapPicker: () => void;
  onUseGeolocation: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragHandleSlot?: React.ReactNode;
}

export function LocationField({
  location,
  waypointIndex,
  canRemove,
  canMoveUp,
  canMoveDown,
  onOpenSearch,
  onOpenMapPicker,
  onUseGeolocation,
  onRemove,
  onMoveUp,
  onMoveDown,
  dragHandleSlot,
}: Props) {
  const isOrigin = location.role === "origin";
  const isDestination = location.role === "destination";
  const isWaypoint = location.role === "waypoint";

  const markerLabel = isOrigin ? "A" : isDestination ? "B" : String(waypointIndex);
  const fieldLabel = isOrigin
    ? COPY.startPoint
    : isDestination
      ? COPY.destination
      : `${COPY.waypointLabel} ${waypointIndex}`;

  return (
    <div className="location-field">
      <div className={`location-marker ${isOrigin || isDestination ? "filled" : "outline"}`} aria-hidden="true">
        {markerLabel}
      </div>

      <div className="location-field-main">
        <label className="field-label" id={`location-label-${location.id}`}>
          {fieldLabel}
        </label>

        <button
          type="button"
          className="location-value"
          aria-labelledby={`location-label-${location.id}`}
          onClick={onOpenSearch}
        >
          <Search size={16} aria-hidden="true" />
          <span className={location.position ? "filled" : "placeholder"}>
            {location.position && location.label ? location.label : COPY.searchPlaceholder}
          </span>
        </button>

        <div className="location-actions">
          <button
            type="button"
            className="location-action"
            onClick={onOpenMapPicker}
            aria-label={`${COPY.pickOnMap}: ${fieldLabel}`}
            title={COPY.pickOnMap}
          >
            <MapPin size={16} aria-hidden="true" />
            <span>{COPY.pickOnMap}</span>
          </button>

          {isOrigin && (
            <button
              type="button"
              className="location-action"
              onClick={onUseGeolocation}
              aria-label={`${COPY.myLocation}: ${fieldLabel}`}
              title={COPY.myLocation}
            >
              <LocateFixed size={16} aria-hidden="true" />
              <span>{COPY.myLocation}</span>
            </button>
          )}

          {isWaypoint && canMoveUp && (
            <button
              type="button"
              className="location-icon-action"
              onClick={onMoveUp}
              aria-label={`${COPY.moveUp}: ${COPY.waypointLabel} ${waypointIndex}`}
            >
              <ChevronUp size={16} aria-hidden="true" />
            </button>
          )}

          {isWaypoint && canMoveDown && (
            <button
              type="button"
              className="location-icon-action"
              onClick={onMoveDown}
              aria-label={`${COPY.moveDown}: ${COPY.waypointLabel} ${waypointIndex}`}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}

          {canRemove && (
            <button
              type="button"
              className="location-icon-action danger"
              onClick={onRemove}
              aria-label={`${COPY.removeWaypoint} ${isWaypoint ? waypointIndex : markerLabel}`}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}

          {isWaypoint && dragHandleSlot}
        </div>
      </div>
    </div>
  );
}

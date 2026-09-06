import { COPY } from "@/content/id";
import type { EditableRouteLocation } from "@/domain/location";
import type { GeocodingResult } from "@/providers/contracts";
import { LocationSearchInline } from "./LocationSearchInline";
import { MapPin, LocateFixed, X, ChevronUp, ChevronDown } from "lucide-react";

interface Props {
  location: EditableRouteLocation;
  waypointIndex: number;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSearch: (query: string, signal: AbortSignal) => Promise<readonly GeocodingResult[]>;
  onSelectSearchResult: (result: GeocodingResult) => void;
  offline: boolean;
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
  onSearch,
  onSelectSearchResult,
  offline,
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

        <LocationSearchInline
          labelId={`location-label-${location.id}`}
          value={location.position && location.label ? location.label : ""}
          onSearch={onSearch}
          onSelect={onSelectSearchResult}
          offline={offline}
        />

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

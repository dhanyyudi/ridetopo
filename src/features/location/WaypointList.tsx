import { useCallback } from "react";
import { COPY } from "@/content/id";
import type { EditableRouteLocation } from "@/domain/location";
import { LocationField } from "./LocationField";
import { PRODUCT_LIMITS } from "@/domain/route";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, ArrowUpDown, GripVertical } from "lucide-react";

interface Props {
  locations: readonly EditableRouteLocation[];
  onAddWaypoint: () => void;
  onRemoveLocation: (id: string) => void;
  onOpenSearch: (location: EditableRouteLocation) => void;
  onOpenMapPicker: (location: EditableRouteLocation) => void;
  onUseGeolocation: (location: EditableRouteLocation) => void;
  onMoveWaypoint: (id: string, direction: -1 | 1) => void;
  onSwap: () => void;
  onReorder: (fromId: string, toId: string) => void;
}

function SortableWaypointItem({
  location,
  children,
}: {
  location: EditableRouteLocation;
  children: (grip: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: location.id,
  });

  const grip = (
    <button
      type="button"
      className="location-grip"
      aria-label={`Seret: ${COPY.waypointLabel}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {children(grip)}
    </div>
  );
}

export function WaypointList({
  locations,
  onAddWaypoint,
  onRemoveLocation,
  onOpenSearch,
  onOpenMapPicker,
  onUseGeolocation,
  onMoveWaypoint,
  onSwap,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const waypointCount = locations.filter((l) => l.role === "waypoint").length;
  const atMax = waypointCount >= PRODUCT_LIMITS.maxIntermediateWaypoints;

  const waypointIds = locations.filter((l) => l.role === "waypoint").map((l) => l.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      onReorder(String(active.id), String(over.id));
    },
    [onReorder],
  );

  return (
    <div className="waypoint-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={waypointIds} strategy={verticalListSortingStrategy}>
          {locations.map((loc) => {
            const waypointIdx = waypointIds.indexOf(loc.id);
            const field = (
              <LocationField
                location={loc}
                waypointIndex={loc.role === "waypoint" ? waypointIdx + 1 : 0}
                canRemove={loc.role === "waypoint"}
                canMoveUp={loc.role === "waypoint" && waypointIdx > 0}
                canMoveDown={loc.role === "waypoint" && waypointIdx < waypointIds.length - 1}
                onOpenSearch={() => onOpenSearch(loc)}
                onOpenMapPicker={() => onOpenMapPicker(loc)}
                onUseGeolocation={() => onUseGeolocation(loc)}
                onRemove={() => onRemoveLocation(loc.id)}
                onMoveUp={() => onMoveWaypoint(loc.id, -1)}
                onMoveDown={() => onMoveWaypoint(loc.id, 1)}
              />
            );
            if (loc.role === "waypoint") {
              return (
                <SortableWaypointItem key={loc.id} location={loc}>
                  {(grip) => (
                    <LocationField
                      location={loc}
                      waypointIndex={waypointIdx + 1}
                      canRemove
                      canMoveUp={waypointIdx > 0}
                      canMoveDown={waypointIdx < waypointIds.length - 1}
                      onOpenSearch={() => onOpenSearch(loc)}
                      onOpenMapPicker={() => onOpenMapPicker(loc)}
                      onUseGeolocation={() => onUseGeolocation(loc)}
                      onRemove={() => onRemoveLocation(loc.id)}
                      onMoveUp={() => onMoveWaypoint(loc.id, -1)}
                      onMoveDown={() => onMoveWaypoint(loc.id, 1)}
                      dragHandleSlot={grip}
                    />
                  )}
                </SortableWaypointItem>
              );
            }
            return <div key={loc.id}>{field}</div>;
          })}
        </SortableContext>
      </DndContext>

      <div className="waypoint-list-actions">
        {atMax ? (
          <p className="inline-hint">{COPY.maxWaypointReached}</p>
        ) : (
          <button type="button" className="btn btn-tertiary" onClick={onAddWaypoint}>
            <Plus size={16} aria-hidden="true" />
            {COPY.addWaypoint}
          </button>
        )}

        <button
          type="button"
          className="btn btn-tertiary"
          onClick={onSwap}
          aria-label={COPY.swapDirections}
          title={COPY.swapDirections}
        >
          <ArrowUpDown size={16} aria-hidden="true" />
          {COPY.swapDirections}
        </button>
      </div>
    </div>
  );
}

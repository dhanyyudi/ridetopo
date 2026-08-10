import { COPY } from "@/content/id";
import { RouteSummary } from "./RouteSummary";
import type { PlannedRoute } from "@/domain/route";

interface Props {
  route: PlannedRoute;
  onReviewRoad: () => void;
  onBack: () => void;
}

export function RouteResultPanel({ route, onReviewRoad, onBack }: Props) {
  const isRoundTrip = route.input.returnToStart;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      padding: "var(--space-4)",
      maxWidth: "480px",
      margin: "0 auto",
      width: "100%",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} className="btn btn-ghost">
          &larr; Ubah rute
        </button>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
          {isRoundTrip ? COPY.returnToStart : `${route.input.locations[0]?.label ?? "A"} → ${route.input.locations[route.input.locations.length - 1]?.label ?? "B"}`}
        </h2>
      </div>

      <RouteSummary
        metrics={route.metrics}
        roundTrip={isRoundTrip}
        limitedReturn={route.limitedReturnAlternatives}
      />

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button onClick={onReviewRoad} className="btn btn-primary" style={{ flex: 1 }}>
          {COPY.roadReview}
        </button>
      </div>
    </div>
  );
}

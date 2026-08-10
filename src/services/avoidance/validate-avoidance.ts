import type { Position } from "@/domain/geo";

export function validateAvoidance(
  avoidedGeometry: readonly Position[],
  candidateGeometry: readonly Position[],
): boolean {
  if (avoidedGeometry.length < 2 || candidateGeometry.length < 2) {
    return true;
  }

  const tolerance = 20;

  for (let i = 0; i < avoidedGeometry.length; i++) {
    const pt = avoidedGeometry[i]!;
    for (let j = 0; j < candidateGeometry.length; j++) {
      const cpt = candidateGeometry[j]!;
      const dx = (pt[0] - cpt[0]) * 111_320 * Math.cos((pt[1] * Math.PI) / 180);
      const dy = (pt[1] - cpt[1]) * 111_320;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= tolerance) {
        return false;
      }
    }
  }

  return true;
}

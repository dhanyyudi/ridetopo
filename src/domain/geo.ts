export type Position = readonly [longitude: number, latitude: number];

export function isValidPosition(pos: Position): boolean {
  const [lng, lat] = pos;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

export function positionsEqual(a: Position, b: Position): boolean {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

export function distanceBetween(a: Position, b: Position): number {
  const R = 6_371_000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

export function straightLineDistance(positions: readonly Position[]): number {
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    total += distanceBetween(positions[i - 1]!, positions[i]!);
  }
  return total;
}

export function deduplicatePositions(
  positions: readonly Position[],
  tolerance: number = 0.001,
): Position[] {
  if (positions.length <= 1) return [...positions] as Position[];
  const result: Position[] = [positions[0]!];
  for (let i = 1; i < positions.length; i++) {
    if (distanceBetween(result[result.length - 1]!, positions[i]!) > tolerance) {
      result.push([...positions[i]!] as Position);
    }
  }
  return result;
}

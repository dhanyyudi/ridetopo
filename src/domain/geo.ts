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
  return a[0] === b[0] && a[1] === b[1];
}

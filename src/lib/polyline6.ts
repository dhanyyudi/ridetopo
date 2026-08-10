/**
 * Encode an array of [longitude, latitude] positions to a Valhalla-compatible polyline6 string.
 * Polyline6 uses 6 decimal digits of precision (1e6 factor).
 */
export function encodePolyline6(positions: readonly (readonly [number, number])[]): string {
  if (positions.length === 0) return "";

  let result = "";
  let prevLng = 0;
  let prevLat = 0;

  for (const [lng, lat] of positions) {
    const dlng = Math.round(lng * 1e6) - prevLng;
    const dlat = Math.round(lat * 1e6) - prevLat;
    prevLng = Math.round(lng * 1e6);
    prevLat = Math.round(lat * 1e6);
    result += encodeSignedInt(dlat) + encodeSignedInt(dlng);
  }

  return result;
}

export function decodePolyline6(encoded: string): readonly (readonly [number, number])[] {
  if (!encoded) return [];

  const result: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result_i = 0;
    do {
      if (index >= encoded.length) throw new Error("Invalid polyline6: unexpected end");
      b = encoded.charCodeAt(index++) - 63;
      result_i |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result_i & 1) !== 0 ? ~(result_i >> 1) : result_i >> 1;
    lat += dlat;

    shift = 0;
    result_i = 0;
    do {
      if (index >= encoded.length) throw new Error("Invalid polyline6: unexpected end");
      b = encoded.charCodeAt(index++) - 63;
      result_i |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result_i & 1) !== 0 ? ~(result_i >> 1) : result_i >> 1;
    lng += dlng;

    result.push([lng / 1e6, lat / 1e6]);
  }

  return result;
}

function encodeSignedInt(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}

export function reverseGeometry(geometry: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  return [...geometry].reverse();
}

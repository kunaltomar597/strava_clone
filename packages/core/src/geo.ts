import type { BoundingBox, LatLng } from "./types.js";

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in meters. */
export function haversineDistanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Perpendicular distance from point `p` to the line through `a`-`b`, in
 * meters, using an equirectangular approximation local to `a`. Accurate
 * enough for the short segments a route is simplified over.
 */
export function perpendicularDistanceM(p: LatLng, a: LatLng, b: LatLng): number {
  const lat0 = toRad(a.lat);
  const project = (pt: LatLng) => ({
    x: toRad(pt.lng - a.lng) * Math.cos(lat0) * EARTH_RADIUS_M,
    y: toRad(pt.lat - a.lat) * EARTH_RADIUS_M,
  });
  const pa = project(a);
  const pb = project(b);
  const pp = project(p);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(pp.x - pa.x, pp.y - pa.y);
  }
  const cross = dx * (pp.y - pa.y) - dy * (pp.x - pa.x);
  return Math.abs(cross) / Math.sqrt(lenSq);
}

export function boundingBoxOf(points: readonly LatLng[]): BoundingBox | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, minLng, maxLat, maxLng };
}

/**
 * Douglas-Peucker line simplification with a meter tolerance. Keeps the
 * first and last point, and any point index array returned refers to the
 * input array's indices so callers can re-slice parallel arrays (time,
 * altitude, etc.) with the same selection.
 */
export function simplifyIndices(points: readonly LatLng[], toleranceM: number): number[] {
  const n = points.length;
  if (n <= 2) return points.map((_, i) => i);

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const [start, end] = next;
    if (end <= start + 1) continue;
    let maxDist = -1;
    let maxIdx = -1;
    const a = points[start]!;
    const b = points[end]!;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistanceM(points[i]!, a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > toleranceM && maxIdx !== -1) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) result.push(i);
  }
  return result;
}

/**
 * Pick `count` roughly evenly spaced indices from a range of length `n`,
 * always including the first and last index. Used to cap chart streams at
 * a fixed point budget independent of activity duration.
 */
export function evenlySpacedIndices(n: number, count: number): number[] {
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const result: number[] = [];
  const step = (n - 1) / (count - 1);
  for (let i = 0; i < count; i++) {
    result.push(Math.round(i * step));
  }
  return Array.from(new Set(result)).sort((x, y) => x - y);
}

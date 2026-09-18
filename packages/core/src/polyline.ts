import type { LatLng } from "./types.js";

/**
 * Google's encoded polyline algorithm format, precision 5 (the standard
 * used by Google Maps and Mapbox's path overlays alike).
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function encodePolyline(points: readonly LatLng[], precision = 5): string {
  const factor = Math.pow(10, precision);
  let output = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const { lat, lng } of points) {
    const lat5 = Math.round(lat * factor);
    const lng5 = Math.round(lng * factor);
    output += encodeSignedNumber(lat5 - prevLat);
    output += encodeSignedNumber(lng5 - prevLng);
    prevLat = lat5;
    prevLng = lng5;
  }

  return output;
}

export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = Math.pow(10, precision);
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const decodeNext = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += decodeNext();
    lng += decodeNext();
    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

function encodeSignedNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) {
    sgnNum = ~sgnNum;
  }
  return encodeNumber(sgnNum);
}

function encodeNumber(num: number): string {
  let output = "";
  while (num >= 0x20) {
    output += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  output += String.fromCharCode(num + 63);
  return output;
}

import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline } from "../src/polyline.js";

describe("polyline encode/decode", () => {
  it("matches Google's canonical example", () => {
    // From Google's own algorithm reference page.
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    const encoded = encodePolyline(points);
    expect(encoded).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("round-trips within floating point precision", () => {
    const points = [
      { lat: 40.73061, lng: -73.935242 },
      { lat: 40.731, lng: -73.9351 },
      { lat: 40.7315, lng: -73.9348 },
    ];
    const decoded = decodePolyline(encodePolyline(points));
    for (let i = 0; i < points.length; i++) {
      expect(decoded[i]!.lat).toBeCloseTo(points[i]!.lat, 5);
      expect(decoded[i]!.lng).toBeCloseTo(points[i]!.lng, 5);
    }
  });

  it("handles an empty track", () => {
    expect(encodePolyline([])).toBe("");
    expect(decodePolyline("")).toEqual([]);
  });
});

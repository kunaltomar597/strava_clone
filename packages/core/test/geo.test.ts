import { describe, expect, it } from "vitest";
import { boundingBoxOf, evenlySpacedIndices, haversineDistanceM, simplifyIndices } from "../src/geo.js";

describe("haversineDistanceM", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceM({ lat: 40.73, lng: -73.93 }, { lat: 40.73, lng: -73.93 })).toBe(0);
  });

  it("matches a known distance within 0.5%", () => {
    // Roughly 1 degree of latitude at the equator is ~111.32 km.
    const distM = haversineDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distM).toBeGreaterThan(111000);
    expect(distM).toBeLessThan(111700);
  });
});

describe("boundingBoxOf", () => {
  it("returns null for an empty array", () => {
    expect(boundingBoxOf([])).toBeNull();
  });

  it("computes min/max across points", () => {
    const box = boundingBoxOf([
      { lat: 1, lng: 2 },
      { lat: -1, lng: 5 },
      { lat: 3, lng: -2 },
    ]);
    expect(box).toEqual({ minLat: -1, minLng: -2, maxLat: 3, maxLng: 5 });
  });
});

describe("simplifyIndices", () => {
  it("keeps every point on a perfectly straight line down to endpoints", () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ lat: i * 0.0001, lng: 0 }));
    const indices = simplifyIndices(points, 5);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(49);
    expect(indices.length).toBeLessThan(points.length);
  });

  it("keeps a sharp corner", () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0, lng: 0.002 },
      { lat: 0.002, lng: 0.002 },
      { lat: 0.004, lng: 0.002 },
    ];
    const indices = simplifyIndices(points, 1);
    expect(indices).toContain(2); // the corner
  });
});

describe("evenlySpacedIndices", () => {
  it("returns all indices when n <= count", () => {
    expect(evenlySpacedIndices(5, 10)).toEqual([0, 1, 2, 3, 4]);
  });

  it("always includes first and last index", () => {
    const indices = evenlySpacedIndices(1000, 50);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(999);
    expect(indices.length).toBeLessThanOrEqual(50);
  });
});

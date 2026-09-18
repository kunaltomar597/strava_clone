import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGpxTrackPoints } from "../src/gpx.js";
import { processActivity } from "../src/process.js";
import type { RawFix } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): RawFix[] {
  const xml = readFileSync(join(__dirname, "fixtures", name), "utf8");
  return parseGpxTrackPoints(xml);
}

describe("processActivity — run with a mid-activity stop", () => {
  const fixes = loadFixture("run-with-stop.gpx");
  const result = processActivity({
    activityId: "01958f1e-0000-7000-8000-000000000001",
    sport: "run",
    fixes,
    privacyZones: [],
    weightKg: 70,
  });

  it("parsed a full-length fixture", () => {
    expect(fixes.length).toBeGreaterThan(1000);
  });

  it("detects the stop: moving time is meaningfully less than elapsed time", () => {
    expect(result.stats.movingTimeS).toBeLessThan(result.stats.elapsedTimeS - 60);
  });

  it("computes distance within 10% of the generated ground truth (~3.24km)", () => {
    expect(result.stats.distanceM).toBeGreaterThan(3240 * 0.9);
    expect(result.stats.distanceM).toBeLessThan(3240 * 1.1);
  });

  it("never reports moving time greater than elapsed time", () => {
    expect(result.stats.movingTimeS).toBeLessThanOrEqual(result.stats.elapsedTimeS);
  });

  it("splits sum to the total distance", () => {
    const summed = result.splitsMetric.reduce((sum, s) => sum + s.distanceM, 0);
    expect(summed).toBeCloseTo(result.stats.distanceM, 0);
  });

  it("finds sub-5k best efforts but not a 5k (activity is ~3.2km)", () => {
    const keys = result.bestEfforts.map((e) => e.effortKey);
    expect(keys).toContain("400m");
    expect(keys).toContain("1k");
    expect(keys).not.toContain("5k");
  });

  it("produces a non-empty summary polyline and bounding box", () => {
    expect(result.summaryPolyline.length).toBeGreaterThan(0);
    expect(result.boundingBox).not.toBeNull();
  });

  it("caps stream points at the configured budget", () => {
    expect(result.streams.pointCount).toBeLessThanOrEqual(2000);
    expect(result.streams.pointCount).toBeGreaterThan(0);
  });

  it("reports no gaps for a continuous 1Hz recording", () => {
    expect(result.gapCount).toBe(0);
  });

  it("estimates calories when weight is provided", () => {
    expect(result.stats.calories).not.toBeNull();
    expect(result.stats.calories!).toBeGreaterThan(0);
  });
});

describe("processActivity — ride", () => {
  const fixes = loadFixture("ride.gpx");
  const result = processActivity({
    activityId: "01958f1e-0000-7000-8000-000000000002",
    sport: "ride",
    fixes,
    privacyZones: [],
    weightKg: null,
  });

  it("computes a plausible average speed for a ride (~7 m/s ground truth)", () => {
    expect(result.stats.avgSpeedMps).toBeGreaterThan(5);
    expect(result.stats.avgSpeedMps).toBeLessThan(9);
  });

  it("skips calorie estimate without a weight", () => {
    expect(result.stats.calories).toBeNull();
  });

  it("finds long-distance best efforts (ride covers >10km)", () => {
    const keys = result.bestEfforts.map((e) => e.effortKey);
    expect(keys).toContain("10k");
  });
});

describe("processActivity — noisy city track", () => {
  const fixes = loadFixture("noisy-city.gpx");
  const result = processActivity({
    activityId: "01958f1e-0000-7000-8000-000000000003",
    sport: "walk",
    fixes,
    privacyZones: [],
    weightKg: 65,
  });

  it("still produces a sane result despite GPS noise and multiple stops", () => {
    expect(result.stats.distanceM).toBeGreaterThan(0);
    expect(result.stats.movingTimeS).toBeLessThan(result.stats.elapsedTimeS);
  });
});

describe("processActivity — privacy zones", () => {
  const fixes = loadFixture("run-with-stop.gpx");
  const start = fixes[0]!;

  it("hides points within the privacy radius of the start", () => {
    const withoutZone = processActivity({
      activityId: "01958f1e-0000-7000-8000-000000000004",
      sport: "run",
      fixes,
      privacyZones: [],
      weightKg: null,
    });
    const withZone = processActivity({
      activityId: "01958f1e-0000-7000-8000-000000000004",
      sport: "run",
      fixes,
      privacyZones: [{ center: { lat: start.lat, lng: start.lng }, radiusM: 300 }],
      weightKg: null,
    });

    expect(withZone.visibleFromIdx).toBeGreaterThan(withoutZone.visibleFromIdx);
    expect(withZone.startLatLng).not.toEqual(withoutZone.startLatLng);
  });

  it("is deterministic for the same activity ID", () => {
    const a = processActivity({
      activityId: "01958f1e-0000-7000-8000-000000000005",
      sport: "run",
      fixes,
      privacyZones: [{ center: { lat: start.lat, lng: start.lng }, radiusM: 300 }],
      weightKg: null,
    });
    const b = processActivity({
      activityId: "01958f1e-0000-7000-8000-000000000005",
      sport: "run",
      fixes,
      privacyZones: [{ center: { lat: start.lat, lng: start.lng }, radiusM: 300 }],
      weightKg: null,
    });
    expect(a.visibleFromIdx).toBe(b.visibleFromIdx);
  });
});

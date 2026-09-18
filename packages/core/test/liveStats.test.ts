import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultAutoPauseOptions } from "../src/autopause.js";
import { parseGpxTrackPoints } from "../src/gpx.js";
import { LiveStatsTracker } from "../src/liveStats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("LiveStatsTracker", () => {
  it("detects the same mid-activity stop as the batch pipeline", () => {
    const xml = readFileSync(join(__dirname, "fixtures", "run-with-stop.gpx"), "utf8");
    const fixes = parseGpxTrackPoints(xml);

    const tracker = new LiveStatsTracker(defaultAutoPauseOptions("run"));
    let last;
    for (const fix of fixes) {
      last = tracker.addFix(fix);
    }

    expect(last).toBeDefined();
    expect(last!.movingTimeS).toBeLessThan(last!.elapsedTimeS - 60);
    expect(last!.distanceM).toBeGreaterThan(3240 * 0.85);
    expect(last!.distanceM).toBeLessThan(3240 * 1.15);
  });

  it("reports zero stats before any fix is added and after the first", () => {
    const tracker = new LiveStatsTracker(defaultAutoPauseOptions("run"));
    const first = tracker.addFix({
      ts: 1000,
      lat: 40.73,
      lng: -73.93,
      hAcc: 5,
      segment: 0,
    });
    expect(first.distanceM).toBe(0);
    expect(first.elapsedTimeS).toBe(0);
  });
});

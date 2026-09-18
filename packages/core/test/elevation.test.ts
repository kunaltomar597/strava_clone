import { describe, expect, it } from "vitest";
import { computeElevation } from "../src/elevation.js";

describe("computeElevation", () => {
  it("reports zero gain on flat ground with small jitter", () => {
    const altitudes = Array.from({ length: 50 }, () => 100 + (Math.random() - 0.5) * 1);
    const result = computeElevation(altitudes, 3, 5);
    expect(result.gainM).toBeLessThan(2);
  });

  it("measures a clean climb", () => {
    // 0m to 100m over 100 samples, monotonic.
    const altitudes = Array.from({ length: 101 }, (_, i) => i);
    const result = computeElevation(altitudes, 3, 1);
    expect(result.gainM).toBeCloseTo(100, 0);
    expect(result.lossM).toBe(0);
    expect(result.highM).toBe(100);
    expect(result.lowM).toBe(0);
  });

  it("measures an up-then-down profile", () => {
    const up = Array.from({ length: 51 }, (_, i) => i * 2); // 0 -> 100
    const down = Array.from({ length: 51 }, (_, i) => 100 - i * 2); // 100 -> 0
    const altitudes = [...up, ...down.slice(1)];
    const result = computeElevation(altitudes, 3, 1);
    expect(result.gainM).toBeCloseTo(100, 0);
    expect(result.lossM).toBeCloseTo(100, 0);
  });

  it("does not register gain below the hysteresis threshold", () => {
    const altitudes = [100, 101, 100, 101.5, 100, 102]; // small wobble under 3m
    const result = computeElevation(altitudes, 3, 1);
    expect(result.gainM).toBe(0);
  });
});

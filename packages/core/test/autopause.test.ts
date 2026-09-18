import { describe, expect, it } from "vitest";
import { AutoPauseDetector } from "../src/autopause.js";

describe("AutoPauseDetector", () => {
  const opts = { speedThresholdMps: 0.7, pauseAfterS: 5, resumeAfterS: 3 };

  it("stays moving through a brief dip under the threshold", () => {
    const d = new AutoPauseDetector(opts);
    let ts = 0;
    let moving = true;
    for (let i = 0; i < 3; i++) {
      moving = d.update(0.2, ts);
      ts += 1000;
    }
    expect(moving).toBe(true);
  });

  it("pauses after sustained slow speed", () => {
    const d = new AutoPauseDetector(opts);
    let ts = 0;
    let moving = true;
    for (let i = 0; i < 8; i++) {
      moving = d.update(0.1, ts);
      ts += 1000;
    }
    expect(moving).toBe(false);
  });

  it("resumes after sustained speed above threshold", () => {
    const d = new AutoPauseDetector(opts);
    let ts = 0;
    for (let i = 0; i < 8; i++) {
      d.update(0.1, ts);
      ts += 1000;
    }
    let moving = true;
    for (let i = 0; i < 5; i++) {
      moving = d.update(2, ts);
      ts += 1000;
    }
    expect(moving).toBe(true);
  });
});

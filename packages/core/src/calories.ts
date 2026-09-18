import type { SportType } from "./types.js";

/**
 * Rough MET (metabolic equivalent) values by sport and effort, used only
 * when no heart-rate data is available. This is a coarse estimate, not a
 * medical-grade calculation; the goal is a plausible number on the
 * activity summary, not precision.
 */
function metFor(sport: SportType, avgSpeedMps: number): number {
  const kph = avgSpeedMps * 3.6;
  switch (sport) {
    case "run":
      if (kph < 8) return 8;
      if (kph < 10) return 10;
      if (kph < 12) return 11.5;
      if (kph < 14) return 13.5;
      return 16;
    case "walk":
      return kph < 5 ? 3 : 4.3;
    case "hike":
      return 6;
    case "ride":
      if (kph < 16) return 4;
      if (kph < 20) return 6.8;
      if (kph < 25) return 8;
      if (kph < 30) return 10;
      return 12;
  }
}

/**
 * Estimated calories burned using MET * weight(kg) * duration(hours), the
 * standard formula for a MET-based estimate.
 */
export function estimateCalories(
  sport: SportType,
  movingTimeS: number,
  avgSpeedMps: number,
  weightKg: number | null,
): number | null {
  if (weightKg == null || weightKg <= 0) return null;
  const met = metFor(sport, avgSpeedMps);
  const hours = movingTimeS / 3600;
  return Math.round(met * weightKg * hours);
}

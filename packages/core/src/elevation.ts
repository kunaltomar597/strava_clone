export interface ElevationResult {
  gainM: number;
  lossM: number;
  highM: number;
  lowM: number;
  /** Simple moving average of the input, same length, for chart display. */
  smoothed: number[];
}

/** Simple centered moving average; window should be odd. */
function movingAverage(values: readonly number[], window: number): number[] {
  const half = Math.floor(window / 2);
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += values[j]!;
    out[i] = sum / (end - start + 1);
  }
  return out;
}

/**
 * Computes elevation gain/loss from a raw altitude series. GPS altitude is
 * noisy, so we smooth first, then only credit a direction reversal to
 * gain/loss once the swing since the last confirmed turning point exceeds
 * `hysteresisM` — this is what keeps flat ground from registering as a
 * constant trickle of fake gain.
 */
export function computeElevation(
  altitudesM: readonly number[],
  hysteresisM = 3,
  smoothingWindow = 5,
): ElevationResult {
  if (altitudesM.length === 0) {
    return { gainM: 0, lossM: 0, highM: 0, lowM: 0, smoothed: [] };
  }

  const smoothed = movingAverage(altitudesM, smoothingWindow);

  let gainM = 0;
  let lossM = 0;
  let highM = smoothed[0]!;
  let lowM = smoothed[0]!;

  // `anchor` is the last confirmed turning point; `extreme` tracks the
  // furthest point reached in the current direction since that anchor.
  let anchor = smoothed[0]!;
  let extreme = smoothed[0]!;
  let direction: "up" | "down" | null = null;

  for (let i = 1; i < smoothed.length; i++) {
    const v = smoothed[i]!;
    if (v > highM) highM = v;
    if (v < lowM) lowM = v;

    if (direction === null) {
      if (v - anchor >= hysteresisM) {
        direction = "up";
        extreme = v;
      } else if (anchor - v >= hysteresisM) {
        direction = "down";
        extreme = v;
      }
      continue;
    }

    if (direction === "up") {
      if (v > extreme) {
        extreme = v;
      } else if (extreme - v >= hysteresisM) {
        gainM += extreme - anchor;
        anchor = extreme;
        direction = "down";
        extreme = v;
      }
    } else {
      if (v < extreme) {
        extreme = v;
      } else if (v - extreme >= hysteresisM) {
        lossM += anchor - extreme;
        anchor = extreme;
        direction = "up";
        extreme = v;
      }
    }
  }

  // Credit whatever movement was still pending at the end of the track.
  if (direction === "up") {
    gainM += extreme - anchor;
  } else if (direction === "down") {
    lossM += anchor - extreme;
  }

  return { gainM, lossM, highM, lowM, smoothed };
}

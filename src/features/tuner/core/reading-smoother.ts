import { SMOOTHING_WINDOW_SIZE } from "./constants";

export type ReadingSmoother = {
  push(frequencyHz: number): number;
  reset(): void;
};

const HALF_DIVISOR = 2;

// A median, unlike a mean, drops a stray reading whole instead of blending it into the result.
export function createReadingSmoother(
  windowSize: number = SMOOTHING_WINDOW_SIZE,
): ReadingSmoother {
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new RangeError(
      `Expected a window size that is a positive integer, got ${windowSize}`,
    );
  }

  const readings: number[] = [];

  return {
    // A missing pitch is `null` upstream, so a frequency here must be a real one.
    push(frequencyHz) {
      if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
        throw new RangeError(
          `Expected a positive finite frequency, got ${frequencyHz} Hz`,
        );
      }

      readings.push(frequencyHz);

      if (readings.length > windowSize) {
        readings.shift();
      }

      return median(readings);
    },

    reset() {
      readings.length = 0;
    },
  };
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const upperMiddle = Math.floor(sorted.length / HALF_DIVISOR);

  if (sorted.length % HALF_DIVISOR === 1) {
    return sorted[upperMiddle];
  }

  return (sorted[upperMiddle - 1] + sorted[upperMiddle]) / HALF_DIVISOR;
}

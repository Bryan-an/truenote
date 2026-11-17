import {
  MAX_FREQUENCY_HZ,
  MIN_FREQUENCY_HZ,
  MIN_RMS_LEVEL,
  YIN_THRESHOLD,
} from "./constants";

export type PitchAnalysis = {
  frequencyHz: number | null;
  // 0 (no period found) to 1 (the signal repeats exactly).
  clarity: number;
  // Root mean square of the samples around their mean, so a DC offset does not count.
  rmsLevel: number;
};

// The longest lag is half the buffer, so the buffer always holds two periods to compare.
const MIN_PERIODS_PER_BUFFER = 2;
// The lags on each side of a dip are two samples apart.
const NEIGHBOR_LAG_SPAN = 2;

// Finds the fundamental frequency with the YIN algorithm (de Cheveigné and Kawahara, 2002).
export function analyzePitch(
  samples: Float32Array,
  sampleRate: number,
): PitchAnalysis {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(
      `Expected a positive finite sample rate, got ${sampleRate} Hz`,
    );
  }

  const rmsLevel = measureRmsLevel(samples);

  if (rmsLevel < MIN_RMS_LEVEL) {
    return { frequencyHz: null, clarity: 0, rmsLevel };
  }

  // A lag is a candidate period, in samples.
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY_HZ);
  const maxLag = Math.min(
    Math.ceil(sampleRate / MIN_FREQUENCY_HZ),
    Math.floor(samples.length / MIN_PERIODS_PER_BUFFER),
  );

  const difference = computeDifference(samples, maxLag);
  const normalizedDifference = normalizeDifference(difference);
  const lag = findPeriodLag(normalizedDifference, minLag, maxLag);

  if (lag === null) {
    return { frequencyHz: null, clarity: 0, rmsLevel };
  }

  return {
    frequencyHz: sampleRate / refineLag(difference, lag),
    clarity: 1 - normalizedDifference[lag],
    rmsLevel,
  };
}

export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
): number | null {
  return analyzePitch(samples, sampleRate).frequencyHz;
}

function measureRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;

  for (const sample of samples) {
    sum += sample;
  }

  const mean = sum / samples.length;
  let sumOfSquares = 0;

  for (const sample of samples) {
    sumOfSquares += (sample - mean) * (sample - mean);
  }

  return Math.sqrt(sumOfSquares / samples.length);
}

// d(lag) = Σ (x[j] − x[j + lag])², for every lag from 0 to maxLag + 1. It is near 0 when the
// signal repeats after `lag` samples. The extra lag past maxLag shows whether a dip at maxLag
// has reached its bottom, and refines it. A constant offset cancels out in the subtraction.
function computeDifference(
  samples: Float32Array,
  maxLag: number,
): Float64Array {
  const lastLag = maxLag + 1;
  // Every lag is summed over the same window, which ends where the last lag runs out of samples.
  const windowSize = Math.max(samples.length - lastLag, 0);
  const difference = new Float64Array(lastLag + 1);

  for (let lag = 1; lag <= lastLag; lag += 1) {
    let sum = 0;

    for (let index = 0; index < windowSize; index += 1) {
      const delta = samples[index] - samples[index + lag];

      sum += delta * delta;
    }

    difference[lag] = sum;
  }

  return difference;
}

// YIN's cumulative mean normalized difference: d′(lag) = d(lag) / (mean of d(1) … d(lag)).
// It starts at 1 and only drops well below 1 at a real period, so one fixed threshold works
// for loud and quiet signals alike.
function normalizeDifference(difference: Float64Array): Float64Array {
  const normalizedDifference = new Float64Array(difference.length);
  let runningSum = 0;

  normalizedDifference[0] = 1;

  for (let lag = 1; lag < difference.length; lag += 1) {
    runningSum += difference[lag];

    normalizedDifference[lag] =
      runningSum === 0 ? 1 : (difference[lag] * lag) / runningSum;
  }

  return normalizedDifference;
}

// The first dip below the threshold is the fundamental period. Later dips are its multiples,
// and taking the first one is what keeps a loud second harmonic from winning. A dip that is
// still falling at maxLag has its bottom past the range, so the tone is below the minimum
// frequency and there is no reading.
function findPeriodLag(
  normalizedDifference: Float64Array,
  minLag: number,
  maxLag: number,
): number | null {
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (normalizedDifference[lag] < YIN_THRESHOLD) {
      let bottomLag = lag;

      while (
        bottomLag <= maxLag &&
        normalizedDifference[bottomLag + 1] < normalizedDifference[bottomLag]
      ) {
        bottomLag += 1;
      }

      return bottomLag <= maxLag ? bottomLag : null;
    }
  }

  return null;
}

// The true period usually falls between two samples. Fit a parabola through the dip and its
// two neighbors and take the lag at its lowest point. The fit uses the raw difference: it
// measured more accurate than the normalized one (0.03 against 0.08 cents at worst).
function refineLag(difference: Float64Array, lag: number): number {
  const previous = difference[lag - 1];
  const current = difference[lag];
  const next = difference[lag + 1];
  const curvature = previous - current + (next - current);

  if (curvature === 0) {
    return lag;
  }

  return lag + (previous - next) / NEIGHBOR_LAG_SPAN / curvature;
}

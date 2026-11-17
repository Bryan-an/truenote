// Test-only signal generators. Every buffer is deterministic, so a failing test replays exactly.

export const TEST_BUFFER_SIZE = 2048;

const DEFAULT_AMPLITUDE = 0.5;
const DEFAULT_GAIN = 0.3;
// Each harmonic starts a little later than the one below, so their peaks do not line up.
const HARMONIC_PHASE_STEP_RAD = 0.7;
const TWO_PI = 2 * Math.PI;

// The "Numerical Recipes" linear congruential generator, on 32-bit unsigned integers.
const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;
const UINT32_RANGE = 2 ** 32;

export function createSineWave({
  frequencyHz,
  sampleRate,
  amplitude = DEFAULT_AMPLITUDE,
  length = TEST_BUFFER_SIZE,
}: {
  frequencyHz: number;
  sampleRate: number;
  amplitude?: number;
  length?: number;
}): Float32Array {
  const samples = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    samples[index] =
      amplitude * Math.sin((TWO_PI * frequencyHz * index) / sampleRate);
  }

  return samples;
}

// `harmonicAmplitudes[0]` is the fundamental, `[1]` the second harmonic, and so on.
export function createHarmonicTone({
  frequencyHz,
  sampleRate,
  harmonicAmplitudes,
  gain = DEFAULT_GAIN,
  length = TEST_BUFFER_SIZE,
}: {
  frequencyHz: number;
  sampleRate: number;
  harmonicAmplitudes: readonly number[];
  gain?: number;
  length?: number;
}): Float32Array {
  const samples = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const fundamentalPhaseRad = (TWO_PI * frequencyHz * index) / sampleRate;

    const sum = harmonicAmplitudes.reduce(
      (total, harmonicAmplitude, harmonicIndex) =>
        total +
        harmonicAmplitude *
          Math.sin(
            (harmonicIndex + 1) * fundamentalPhaseRad +
              HARMONIC_PHASE_STEP_RAD * harmonicIndex,
          ),
      0,
    );

    samples[index] = gain * sum;
  }

  return samples;
}

// White noise, uniform in [-amplitude, amplitude). The same seed always gives the same buffer.
export function createNoise({
  amplitude,
  seed,
  length = TEST_BUFFER_SIZE,
}: {
  amplitude: number;
  seed: number;
  length?: number;
}): Float32Array {
  const samples = new Float32Array(length);
  let state = seed >>> 0;

  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0;
    samples[index] = amplitude * ((state / UINT32_RANGE) * 2 - 1);
  }

  return samples;
}

export function createSilence(length: number = TEST_BUFFER_SIZE): Float32Array {
  return new Float32Array(length);
}

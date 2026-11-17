import { describe, expect, it } from "vitest";
import { analyzePitch, detectPitch } from "./detect-pitch";
import { centsBetween } from "./note-math";
import { STANDARD_TUNING } from "./standard-tuning";
import {
  createHarmonicTone,
  createNoise,
  createSilence,
  createSineWave,
} from "./testing/synthetic-signals";

const SAMPLE_RATES = [44_100, 48_000];
const STRING_FREQUENCIES_HZ = STANDARD_TUNING.map(
  (string) => string.frequencyHz,
);

// 70 Hz to 399.3 Hz in steps that never land on a whole number of samples per period.
const SWEEP_FREQUENCIES_HZ = [
  ...Array.from({ length: 90 }, (_, index) => 70 + 3.7 * index),
  ...STRING_FREQUENCIES_HZ,
];

function expectWithinOneCent(detectedHz: number | null, trueHz: number) {
  expect(detectedHz, `no pitch detected at ${trueHz} Hz`).not.toBeNull();
  expect(
    Math.abs(centsBetween(detectedHz as number, trueHz)),
    `at ${trueHz} Hz`,
  ).toBeLessThan(1);
}

describe("detectPitch", () => {
  it.each(SAMPLE_RATES)(
    "detects pure tones from 70 to 400 Hz within 1 cent at %i Hz",
    (sampleRate) => {
      for (const frequencyHz of SWEEP_FREQUENCIES_HZ) {
        const samples = createSineWave({ frequencyHz, sampleRate });

        expectWithinOneCent(detectPitch(samples, sampleRate), frequencyHz);
      }
    },
  );

  it.each(SAMPLE_RATES)(
    "detects harmonic-rich tones within 1 cent at %i Hz",
    (sampleRate) => {
      for (const frequencyHz of SWEEP_FREQUENCIES_HZ) {
        const samples = createHarmonicTone({
          frequencyHz,
          sampleRate,
          harmonicAmplitudes: [1, 0.8, 0.6, 0.4, 0.3, 0.2],
        });

        expectWithinOneCent(detectPitch(samples, sampleRate), frequencyHz);
      }
    },
  );

  // Review Focus 3: a phone microphone hears little of the low E fundamental.
  it("locks onto the fundamental when the second harmonic is louder", () => {
    const sampleRate = 48_000;

    for (const frequencyHz of STRING_FREQUENCIES_HZ) {
      const samples = createHarmonicTone({
        frequencyHz,
        sampleRate,
        harmonicAmplitudes: [0.15, 1, 0.5, 0.3],
      });

      expectWithinOneCent(detectPitch(samples, sampleRate), frequencyHz);
    }
  });

  // Review Focus 2: some Android microphones add a constant offset to the signal.
  it("ignores a DC offset", () => {
    const sampleRate = 48_000;
    const samples = createSineWave({ frequencyHz: 110, sampleRate }).map(
      (sample) => sample + 0.3,
    );

    expectWithinOneCent(detectPitch(samples, sampleRate), 110);
  });

  it("detects a clipped low E", () => {
    const sampleRate = 48_000;
    const samples = createSineWave({
      frequencyHz: 82.41,
      sampleRate,
      amplitude: 0.9,
    }).map((sample) => Math.max(-0.4, Math.min(0.4, sample)));

    expectWithinOneCent(detectPitch(samples, sampleRate), 82.41);
  });

  it("returns null for silence", () => {
    expect(detectPitch(createSilence(), 48_000)).toBeNull();
  });

  it("returns null for white noise", () => {
    const samples = createNoise({ amplitude: 0.3, seed: 1 });

    expect(detectPitch(samples, 48_000)).toBeNull();
  });

  it("returns null below the input level gate", () => {
    const sampleRate = 48_000;
    const samples = createSineWave({
      frequencyHz: 110,
      sampleRate,
      amplitude: 0.005,
    });

    expect(detectPitch(samples, sampleRate)).toBeNull();
  });

  it("returns null below the minimum frequency", () => {
    const sampleRate = 48_000;
    const samples = createSineWave({ frequencyHz: 50, sampleRate });

    expect(detectPitch(samples, sampleRate)).toBeNull();
  });

  // The dip for these tones starts inside the search range but bottoms out past its end.
  it.each(SAMPLE_RATES)(
    "returns null just below the minimum frequency at %i Hz",
    (sampleRate) => {
      for (const frequencyHz of [55, 58, 59.5]) {
        const samples = createSineWave({ frequencyHz, sampleRate });

        expect(detectPitch(samples, sampleRate), `at ${frequencyHz} Hz`).toBe(
          null,
        );
      }
    },
  );

  it("detects a tone at the minimum frequency", () => {
    const sampleRate = 48_000;
    const samples = createSineWave({ frequencyHz: 60, sampleRate });

    expectWithinOneCent(detectPitch(samples, sampleRate), 60);
  });

  it("returns null for an empty buffer", () => {
    expect(detectPitch(new Float32Array(0), 48_000)).toBeNull();
  });

  it("returns null for a buffer too short to hold two periods", () => {
    const sampleRate = 48_000;
    const samples = createSineWave({
      frequencyHz: 110,
      sampleRate,
      length: 512,
    });

    expect(detectPitch(samples, sampleRate)).toBeNull();
  });

  it.each([0, -48_000, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws for a sample rate of %d Hz",
    (sampleRate) => {
      expect(() => detectPitch(createSilence(), sampleRate)).toThrow(
        RangeError,
      );
    },
  );
});

describe("analyzePitch", () => {
  it("reports high clarity for a clean tone", () => {
    const sampleRate = 48_000;
    const samples = createSineWave({ frequencyHz: 110, sampleRate });

    expect(analyzePitch(samples, sampleRate).clarity).toBeGreaterThan(0.9);
  });

  it("reports the RMS level", () => {
    const sampleRate = 48_000;
    // Exactly 5 cycles in 2048 samples, so the RMS is exactly amplitude / √2.
    const samples = createSineWave({
      frequencyHz: 117.1875,
      sampleRate,
      amplitude: 0.5,
    });

    expect(analyzePitch(samples, sampleRate).rmsLevel).toBeCloseTo(
      0.5 / Math.SQRT2,
      4,
    );
  });

  it("reports zero clarity for silence", () => {
    expect(analyzePitch(createSilence(), 48_000)).toEqual({
      frequencyHz: null,
      clarity: 0,
      rmsLevel: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  IN_TUNE_HOLD_MS,
  IN_TUNE_TOLERANCE_CENTS,
  OUT_OF_TUNE_THRESHOLD_CENTS,
  PITCH_HOLD_MS,
  PITCH_LOST_MS,
} from "./constants";
import { STANDARD_TUNING, STRING_ID } from "./standard-tuning";
import {
  INITIAL_TUNING_STATE,
  updateTuningState,
  type TuningState,
} from "./tuning-state";

const atCents = (hz: number, cents: number) => hz * 2 ** (cents / 1200);

// One update per animation frame at 60 Hz, rounded to whole milliseconds.
const FRAME_MS = 16;

const [lowE, a] = STANDARD_TUNING;
const IN_BAND_HZ = atCents(a.frequencyHz, 3);
// With one update every 16 ms from 0, the hold of 500 ms is first met at 512 ms.
const FIRST_IN_TUNE_MS = 512;

// Applies one update every 16 ms from `fromMs` to `toMs` inclusive and returns every state.
function feedEach(
  state: TuningState,
  frequencyHz: number | null,
  fromMs: number,
  toMs: number,
): TuningState[] {
  const states: TuningState[] = [];
  let current = state;

  for (let nowMs = fromMs; nowMs <= toMs; nowMs += FRAME_MS) {
    current = updateTuningState(current, frequencyHz, nowMs);
    states.push(current);
  }

  return states;
}

function feed(
  state: TuningState,
  frequencyHz: number | null,
  fromMs: number,
  toMs: number,
): TuningState {
  return feedEach(state, frequencyHz, fromMs, toMs).at(-1) ?? state;
}

// The A string in tune, with its ding already played: in band from 0 to 512 ms.
function tunedA(): TuningState {
  return feed(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, FIRST_IN_TUNE_MS);
}

describe("updateTuningState", () => {
  it("uses the thresholds from the spec", () => {
    expect(IN_TUNE_TOLERANCE_CENTS).toBe(5);
    expect(OUT_OF_TUNE_THRESHOLD_CENTS).toBe(8);
    expect(IN_TUNE_HOLD_MS).toBe(500);
    expect(PITCH_HOLD_MS).toBe(1500);
    expect(PITCH_LOST_MS).toBe(200);
  });

  it("starts with no reading", () => {
    expect(INITIAL_TUNING_STATE).toEqual({
      reading: null,
      inBandSinceMs: null,
      lastPitchAtMs: null,
      shouldPlayDing: false,
    });
  });

  it("stays empty while there is no pitch yet", () => {
    expect(feed(INITIAL_TUNING_STATE, null, 0, 3000)).toEqual(
      INITIAL_TUNING_STATE,
    );
  });

  it("shows the nearest string and its offset", () => {
    const state = updateTuningState(INITIAL_TUNING_STATE, IN_BAND_HZ, 0);

    expect(state.reading?.string).toBe(a);
    expect(state.reading?.offsetCents).toBeCloseTo(3, 6);
    expect(state.reading?.isInTune).toBe(false);
    expect(state.shouldPlayDing).toBe(false);
  });

  it("enters in tune after 500 ms within ±5 cents", () => {
    const at496 = feed(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, 496);
    const at512 = updateTuningState(at496, IN_BAND_HZ, 512);
    const at528 = updateTuningState(at512, IN_BAND_HZ, 528);

    expect(at496.reading?.isInTune).toBe(false);
    expect(at496.shouldPlayDing).toBe(false);
    expect(at512.reading?.isInTune).toBe(true);
    expect(at512.shouldPlayDing).toBe(true);
    expect(at528.reading?.isInTune).toBe(true);
    expect(at528.shouldPlayDing).toBe(false);
  });

  it("enters in tune at exactly 500 ms", () => {
    const at496 = feed(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, 496);
    const at499 = updateTuningState(at496, IN_BAND_HZ, 499);
    const at500 = updateTuningState(at496, IN_BAND_HZ, 500);

    expect(at499.reading?.isInTune).toBe(false);
    expect(at500.reading?.isInTune).toBe(true);
    expect(at500.shouldPlayDing).toBe(true);
  });

  it("never enters in tune outside ±5 cents", () => {
    const sharp = feedEach(
      INITIAL_TUNING_STATE,
      atCents(a.frequencyHz, 6),
      0,
      1000,
    );
    const flat = feedEach(
      INITIAL_TUNING_STATE,
      atCents(a.frequencyHz, -6),
      0,
      1000,
    );

    expect(sharp.some((state) => state.reading?.isInTune)).toBe(false);
    expect(flat.some((state) => state.reading?.isInTune)).toBe(false);
  });

  it("enters in tune on the flat side too", () => {
    const flatHz = atCents(a.frequencyHz, -3);

    const state = feed(INITIAL_TUNING_STATE, flatHz, 0, FIRST_IN_TUNE_MS);

    expect(state.reading?.offsetCents).toBeCloseTo(-3, 6);
    expect(state.reading?.isInTune).toBe(true);
    expect(state.shouldPlayDing).toBe(true);
  });

  it("restarts the hold when the offset leaves ±5 cents", () => {
    const steady = feed(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, 304);
    const nudged = updateTuningState(steady, atCents(a.frequencyHz, 6), 320);
    const at800 = feed(nudged, IN_BAND_HZ, 336, 800);
    const at896 = feed(at800, IN_BAND_HZ, 816, 896);

    expect(nudged.inBandSinceMs).toBeNull();
    expect(at800.reading?.isInTune).toBe(false);
    expect(at896.reading?.isInTune).toBe(true);
  });

  it("stays in tune up to ±8 cents and leaves beyond it", () => {
    const sharp = updateTuningState(tunedA(), atCents(a.frequencyHz, 7), 528);
    const flat = updateTuningState(sharp, atCents(a.frequencyHz, -7), 544);
    const tooSharp = updateTuningState(flat, atCents(a.frequencyHz, 9), 560);
    const tooFlat = updateTuningState(flat, atCents(a.frequencyHz, -9), 560);

    expect(sharp.reading?.isInTune).toBe(true);
    expect(sharp.shouldPlayDing).toBe(false);
    expect(sharp.inBandSinceMs).toBe(0);
    expect(flat.reading?.isInTune).toBe(true);
    expect(flat.shouldPlayDing).toBe(false);
    expect(tooSharp.reading?.isInTune).toBe(false);
    expect(tooSharp.inBandSinceMs).toBeNull();
    expect(tooFlat.reading?.isInTune).toBe(false);
    expect(tooFlat.inBandSinceMs).toBeNull();
  });

  it("plays the ding again after leaving and re-entering", () => {
    const left = updateTuningState(tunedA(), atCents(a.frequencyHz, 9), 528);
    const at1040 = feed(left, IN_BAND_HZ, 544, 1040);
    const at1056 = updateTuningState(at1040, IN_BAND_HZ, 1056);

    expect(left.reading?.isInTune).toBe(false);
    expect(at1040.reading?.isInTune).toBe(false);
    expect(at1056.reading?.isInTune).toBe(true);
    expect(at1056.shouldPlayDing).toBe(true);
  });

  it("never repeats the ding while the string keeps sounding in tune", () => {
    const states = feedEach(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, 3000);

    expect(states.filter((state) => state.shouldPlayDing)).toHaveLength(1);
    expect(states.at(-1)?.reading?.isInTune).toBe(true);
  });

  it("keeps the last reading for 1.5 s after the pitch is lost", () => {
    const sounding = feed(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, 592);
    const lastPitch = updateTuningState(sounding, IN_BAND_HZ, 600);
    const fading = feed(lastPitch, null, 616, 2088);
    const at2099 = updateTuningState(fading, null, 2099);
    const at2100 = updateTuningState(at2099, null, 2100);

    expect(at2099.reading).toEqual(lastPitch.reading);
    expect(at2099.reading?.isInTune).toBe(true);
    expect(at2100).toEqual(INITIAL_TUNING_STATE);
  });

  it("clears the ding when the pitch drops out right after it", () => {
    const dinged = tunedA();
    const silent = updateTuningState(dinged, null, 528);

    expect(dinged.shouldPlayDing).toBe(true);
    expect(silent).toEqual({ ...dinged, shouldPlayDing: false });
  });

  it("treats a pitch after 200 ms of silence as a new pluck", () => {
    const silent = feed(tunedA(), null, 528, 704);
    const replucked = updateTuningState(silent, IN_BAND_HZ, 712);
    const at1208 = feed(replucked, IN_BAND_HZ, 728, 1208);
    const at1224 = updateTuningState(at1208, IN_BAND_HZ, 1224);

    expect(silent.reading?.isInTune).toBe(true);
    expect(replucked.reading?.isInTune).toBe(false);
    expect(replucked.shouldPlayDing).toBe(false);
    expect(at1208.reading?.isInTune).toBe(false);
    expect(at1224.reading?.isInTune).toBe(true);
    expect(at1224.shouldPlayDing).toBe(true);
  });

  it("ignores dropouts shorter than 200 ms", () => {
    const silent = feed(tunedA(), null, 528, 608);
    const after100 = updateTuningState(silent, IN_BAND_HZ, 624);
    const after199 = updateTuningState(silent, IN_BAND_HZ, 711);

    expect(after100.reading?.isInTune).toBe(true);
    expect(after100.shouldPlayDing).toBe(false);
    expect(after199.reading?.isInTune).toBe(true);
    expect(after199.shouldPlayDing).toBe(false);
  });

  it("keeps counting the hold across a short dropout", () => {
    const steady = feed(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, 304);
    const silent = feed(steady, null, 320, 400);
    const at496 = feed(silent, IN_BAND_HZ, 416, 496);
    const at512 = updateTuningState(at496, IN_BAND_HZ, 512);

    expect(at496.reading?.isInTune).toBe(false);
    expect(at512.reading?.isInTune).toBe(true);
    expect(at512.shouldPlayDing).toBe(true);
  });

  // Review Focus: the previous string may still be ringing in tune when the next one is played.
  it("resets when another string is played", () => {
    const lowEHz = atCents(lowE.frequencyHz, 2);

    const switched = updateTuningState(tunedA(), lowEHz, 528);
    const at1024 = feed(switched, lowEHz, 544, 1024);
    const at1040 = updateTuningState(at1024, lowEHz, 1040);

    expect(switched.reading?.string.id).toBe(STRING_ID.LOW_E);
    expect(switched.reading?.offsetCents).toBeCloseTo(2, 6);
    expect(switched.reading?.isInTune).toBe(false);
    expect(switched.shouldPlayDing).toBe(false);
    expect(at1024.reading?.isInTune).toBe(false);
    expect(at1040.reading?.isInTune).toBe(true);
    expect(at1040.shouldPlayDing).toBe(true);
  });

  it("restarts the hold when the string changes before it is in tune", () => {
    const lowEHz = atCents(lowE.frequencyHz, 2);

    const onA = feed(INITIAL_TUNING_STATE, IN_BAND_HZ, 0, 304);
    const at816 = feed(onA, lowEHz, 320, 816);
    const at832 = updateTuningState(at816, lowEHz, 832);

    expect(at816.reading?.isInTune).toBe(false);
    expect(at832.reading?.isInTune).toBe(true);
  });

  // Review Focus: the needle pins at ±50 cents, but the text shows the true offset.
  it("reports offsets beyond ±50 cents unchanged", () => {
    const state = updateTuningState(INITIAL_TUNING_STATE, 80, 0);

    expect(state.reading?.string.id).toBe(STRING_ID.LOW_E);
    expect(state.reading?.offsetCents).toBeCloseTo(-51.3, 1);
    expect(state.reading?.isInTune).toBe(false);
  });

  it("never mutates the state it is given", () => {
    const frozen = Object.freeze({
      ...tunedA(),
      reading: Object.freeze(tunedA().reading),
    });
    const snapshot = structuredClone(frozen);

    updateTuningState(frozen, IN_BAND_HZ, 528);
    updateTuningState(frozen, atCents(a.frequencyHz, 9), 528);
    updateTuningState(frozen, null, 528);
    updateTuningState(frozen, null, 5000);

    expect(frozen).toEqual(snapshot);
    expect(INITIAL_TUNING_STATE).toEqual({
      reading: null,
      inBandSinceMs: null,
      lastPitchAtMs: null,
      shouldPlayDing: false,
    });
  });

  it.each([0, -110, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws for %d Hz, which is not a pitch",
    (frequencyHz) => {
      expect(() =>
        updateTuningState(INITIAL_TUNING_STATE, frequencyHz, 0),
      ).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "throws for a time of %d ms",
    (nowMs) => {
      expect(() =>
        updateTuningState(INITIAL_TUNING_STATE, IN_BAND_HZ, nowMs),
      ).toThrow(RangeError);
      expect(() =>
        updateTuningState(INITIAL_TUNING_STATE, null, nowMs),
      ).toThrow(RangeError);
    },
  );
});

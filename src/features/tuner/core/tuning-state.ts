import {
  IN_TUNE_HOLD_MS,
  IN_TUNE_TOLERANCE_CENTS,
  OUT_OF_TUNE_THRESHOLD_CENTS,
  PITCH_HOLD_MS,
  PITCH_LOST_MS,
} from "./constants";
import { findNearestString } from "./find-nearest-string";
import type { GuitarString } from "./standard-tuning";

export type TuningReading = {
  string: GuitarString;
  offsetCents: number;
  isInTune: boolean;
};

export type TuningState = {
  reading: TuningReading | null;
  // When the offset entered the tolerance band; `null` while it is outside.
  inBandSinceMs: number | null;
  lastPitchAtMs: number | null;
  // True on the one update where the string enters in tune.
  shouldPlayDing: boolean;
};

export const INITIAL_TUNING_STATE: TuningState = {
  reading: null,
  inBandSinceMs: null,
  lastPitchAtMs: null,
  shouldPlayDing: false,
};

// `frequencyHz` is `null` when no pitch was detected. `nowMs` is any clock that only moves forward.
export function updateTuningState(
  state: TuningState,
  frequencyHz: number | null,
  nowMs: number,
): TuningState {
  if (!Number.isFinite(nowMs)) {
    throw new RangeError(`Expected a finite time, got ${nowMs} ms`);
  }

  return frequencyHz === null
    ? updateWithoutPitch(state, nowMs)
    : updateWithPitch(state, frequencyHz, nowMs);
}

// The last reading stays on screen for a while, so the result can be read after the note fades.
function updateWithoutPitch(state: TuningState, nowMs: number): TuningState {
  if (
    state.lastPitchAtMs !== null &&
    nowMs - state.lastPitchAtMs >= PITCH_HOLD_MS
  ) {
    return INITIAL_TUNING_STATE;
  }

  return state.shouldPlayDing ? { ...state, shouldPlayDing: false } : state;
}

function updateWithPitch(
  state: TuningState,
  frequencyHz: number,
  nowMs: number,
): TuningState {
  const { string, offsetCents } = findNearestString(frequencyHz);

  // A new pluck starts from scratch, so re-plucking a tuned string confirms it with another ding.
  const isNewPluck =
    state.lastPitchAtMs === null ||
    nowMs - state.lastPitchAtMs >= PITCH_LOST_MS ||
    state.reading?.string.id !== string.id;
  const wasInTune = !isNewPluck && state.reading?.isInTune === true;
  const previousInBandSinceMs = isNewPluck ? null : state.inBandSinceMs;

  const { isInTune, inBandSinceMs } = wasInTune
    ? stayInTune(offsetCents, previousInBandSinceMs)
    : enterInTune(offsetCents, previousInBandSinceMs, nowMs);

  return {
    reading: { string, offsetCents, isInTune },
    inBandSinceMs,
    lastPitchAtMs: nowMs,
    shouldPlayDing: isInTune && !wasInTune,
  };
}

type InTuneDecision = { isInTune: boolean; inBandSinceMs: number | null };

// Leaving takes a wider offset than entering, so a string hovering at the edge does not flicker.
function stayInTune(
  offsetCents: number,
  inBandSinceMs: number | null,
): InTuneDecision {
  if (Math.abs(offsetCents) > OUT_OF_TUNE_THRESHOLD_CENTS) {
    return { isInTune: false, inBandSinceMs: null };
  }

  return { isInTune: true, inBandSinceMs };
}

// Entering takes a continuous stretch inside the tolerance band, so a passing sweep does not count.
function enterInTune(
  offsetCents: number,
  previousInBandSinceMs: number | null,
  nowMs: number,
): InTuneDecision {
  if (Math.abs(offsetCents) > IN_TUNE_TOLERANCE_CENTS) {
    return { isInTune: false, inBandSinceMs: null };
  }

  const inBandSinceMs = previousInBandSinceMs ?? nowMs;

  return { isInTune: nowMs - inBandSinceMs >= IN_TUNE_HOLD_MS, inBandSinceMs };
}

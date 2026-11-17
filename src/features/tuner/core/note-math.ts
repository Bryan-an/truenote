import {
  A4_MIDI_NOTE,
  CENTS_PER_OCTAVE,
  MAX_MIDI_NOTE,
  MIN_MIDI_NOTE,
  OCTAVE_FREQUENCY_RATIO,
  REFERENCE_A4_HZ,
  SEMITONES_PER_OCTAVE,
} from "./constants";

export const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

export function midiToFrequencyHz(midiNote: number): number {
  return (
    REFERENCE_A4_HZ *
    OCTAVE_FREQUENCY_RATIO ** ((midiNote - A4_MIDI_NOTE) / SEMITONES_PER_OCTAVE)
  );
}

export function midiToNoteName(midiNote: number): NoteName {
  if (
    !Number.isInteger(midiNote) ||
    midiNote < MIN_MIDI_NOTE ||
    midiNote > MAX_MIDI_NOTE
  ) {
    throw new RangeError(
      `Expected an integer MIDI note from ${MIN_MIDI_NOTE} to ${MAX_MIDI_NOTE}, got ${midiNote}`,
    );
  }

  return NOTE_NAMES[midiNote % SEMITONES_PER_OCTAVE];
}

// MIDI 60 is middle C (C4), so octave numbers start one below the MIDI octave.
export function midiToOctave(midiNote: number): number {
  return Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1;
}

// A missing pitch is `null` upstream, so a frequency here must be a real one.
export function centsBetween(frequencyHz: number, referenceHz: number): number {
  if (!isPositiveFinite(frequencyHz) || !isPositiveFinite(referenceHz)) {
    throw new RangeError(
      `Expected positive finite frequencies, got ${frequencyHz} Hz and ${referenceHz} Hz`,
    );
  }

  return CENTS_PER_OCTAVE * Math.log2(frequencyHz / referenceHz);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

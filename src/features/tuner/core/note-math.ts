import {
  A4_MIDI_NOTE,
  CENTS_PER_OCTAVE,
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
  return NOTE_NAMES[midiNote % SEMITONES_PER_OCTAVE];
}

// MIDI 60 is middle C (C4), so octave numbers start one below the MIDI octave.
export function midiToOctave(midiNote: number): number {
  return Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1;
}

export function centsBetween(frequencyHz: number, referenceHz: number): number {
  return CENTS_PER_OCTAVE * Math.log2(frequencyHz / referenceHz);
}

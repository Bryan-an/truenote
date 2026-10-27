import {
  midiToFrequencyHz,
  midiToNoteName,
  midiToOctave,
  type NoteName,
} from "./note-math";

export const STRING_ID = {
  LOW_E: "low-e",
  A: "a",
  D: "d",
  G: "g",
  B: "b",
  HIGH_E: "high-e",
} as const;

export type StringId = (typeof STRING_ID)[keyof typeof STRING_ID];

export type GuitarString = {
  id: StringId;
  stringNumber: number;
  noteName: NoteName;
  octave: number;
  frequencyHz: number;
};

const E2_MIDI_NOTE = 40;
const A2_MIDI_NOTE = 45;
const D3_MIDI_NOTE = 50;
const G3_MIDI_NOTE = 55;
const B3_MIDI_NOTE = 59;
const E4_MIDI_NOTE = 64;

// Ordered string 6 (low E) → string 1 (high E).
export const STANDARD_TUNING: readonly GuitarString[] = [
  { id: STRING_ID.LOW_E, stringNumber: 6, midiNote: E2_MIDI_NOTE },
  { id: STRING_ID.A, stringNumber: 5, midiNote: A2_MIDI_NOTE },
  { id: STRING_ID.D, stringNumber: 4, midiNote: D3_MIDI_NOTE },
  { id: STRING_ID.G, stringNumber: 3, midiNote: G3_MIDI_NOTE },
  { id: STRING_ID.B, stringNumber: 2, midiNote: B3_MIDI_NOTE },
  { id: STRING_ID.HIGH_E, stringNumber: 1, midiNote: E4_MIDI_NOTE },
].map(({ id, stringNumber, midiNote }) => ({
  id,
  stringNumber,
  noteName: midiToNoteName(midiNote),
  octave: midiToOctave(midiNote),
  frequencyHz: midiToFrequencyHz(midiNote),
}));

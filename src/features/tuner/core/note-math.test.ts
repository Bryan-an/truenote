import { describe, expect, it } from "vitest";
import {
  centsBetween,
  midiToFrequencyHz,
  midiToNoteName,
  midiToOctave,
} from "./note-math";

const atCents = (hz: number, cents: number) => hz * 2 ** (cents / 1200);

describe("midiToFrequencyHz", () => {
  it("returns exactly 440 Hz for A4 (MIDI 69)", () => {
    expect(midiToFrequencyHz(69)).toBe(440);
  });

  it("halves the frequency one octave down and doubles it one octave up", () => {
    expect(midiToFrequencyHz(57)).toBeCloseTo(220, 10);
    expect(midiToFrequencyHz(81)).toBeCloseTo(880, 10);
  });
});

describe("midiToNoteName", () => {
  it.each([
    [40, "E"],
    [45, "A"],
    [61, "C♯"],
  ])("names MIDI %i as %s", (midiNote, noteName) => {
    expect(midiToNoteName(midiNote)).toBe(noteName);
  });
});

describe("midiToOctave", () => {
  it.each([
    [40, 2],
    [60, 4],
    [64, 4],
  ])("puts MIDI %i in octave %i", (midiNote, octave) => {
    expect(midiToOctave(midiNote)).toBe(octave);
  });
});

describe("centsBetween", () => {
  it("is 0 for the same frequency", () => {
    expect(centsBetween(440, 440)).toBe(0);
  });

  it("is 1200 for one octave up", () => {
    expect(centsBetween(880, 440)).toBe(1200);
  });

  it("is about -100 for one semitone down", () => {
    expect(centsBetween(415.3, 440)).toBeCloseTo(-100, 1);
  });

  it("recovers a small offset", () => {
    expect(centsBetween(atCents(110, 3), 110)).toBeCloseTo(3, 10);
  });
});

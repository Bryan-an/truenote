import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "./standard-tuning";

describe("STANDARD_TUNING", () => {
  it("orders the strings from string 6 (low E) to string 1 (high E)", () => {
    expect(STANDARD_TUNING.map((string) => string.id)).toEqual([
      "low-e",
      "a",
      "d",
      "g",
      "b",
      "high-e",
    ]);
    expect(STANDARD_TUNING.map((string) => string.stringNumber)).toEqual([
      6, 5, 4, 3, 2, 1,
    ]);
  });

  it("tunes the strings to E2 A2 D3 G3 B3 E4", () => {
    expect(
      STANDARD_TUNING.map((string) => `${string.noteName}${string.octave}`),
    ).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
  });

  it("gives each string its standard frequency", () => {
    const expectedFrequenciesHz = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];

    expectedFrequenciesHz.forEach((frequencyHz, index) => {
      expect(STANDARD_TUNING[index].frequencyHz).toBeCloseTo(frequencyHz, 2);
    });
  });
});

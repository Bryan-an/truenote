import { describe, expect, it } from "vitest";
import { findNearestString } from "./find-nearest-string";
import {
  STANDARD_TUNING,
  STRING_ID,
  type GuitarString,
} from "./standard-tuning";

describe("findNearestString", () => {
  it.each(STANDARD_TUNING)(
    "matches the $id string at its own frequency",
    (string) => {
      const match = findNearestString(string.frequencyHz);

      expect(match.string).toBe(string);
      expect(match.offsetCents).toBeCloseTo(0, 6);
    },
  );

  it("reports how sharp a pitch is against its nearest string", () => {
    const match = findNearestString(112);

    expect(match.string.id).toBe(STRING_ID.A);
    expect(match.offsetCents).toBeCloseTo(31.19, 1);
  });

  it("reports offsets beyond ±50 cents unchanged", () => {
    const match = findNearestString(80);

    expect(match.string.id).toBe(STRING_ID.LOW_E);
    expect(match.offsetCents).toBeCloseTo(-51.3, 1);
  });

  it("matches the low E string for a pitch far below it", () => {
    expect(findNearestString(60).string.id).toBe(STRING_ID.LOW_E);
  });

  it("matches the high E string for a pitch far above it", () => {
    expect(findNearestString(1000).string.id).toBe(STRING_ID.HIGH_E);
  });

  // The halfway point between E2 and A2 is 95.2 Hz in cents but 96.2 Hz in Hz.
  it("picks the nearest string in cents, not in Hz", () => {
    expect(findNearestString(95).string.id).toBe(STRING_ID.LOW_E);
    expect(findNearestString(96).string.id).toBe(STRING_ID.A);
  });

  describe("with a custom tuning", () => {
    const lowString: GuitarString = {
      id: STRING_ID.LOW_E,
      stringNumber: 2,
      noteName: "G",
      octave: 2,
      frequencyHz: 100,
    };
    const highString: GuitarString = {
      id: STRING_ID.HIGH_E,
      stringNumber: 1,
      noteName: "G",
      octave: 4,
      frequencyHz: 400,
    };

    it("matches against the given strings instead of the standard tuning", () => {
      const match = findNearestString(110, [lowString, highString]);

      expect(match.string).toBe(lowString);
      expect(match.offsetCents).toBeCloseTo(165, 1);
    });

    // 200 Hz is exactly one octave from both strings.
    it("gives an exact tie to the first string in tuning order", () => {
      expect(findNearestString(200, [lowString, highString])).toEqual({
        string: lowString,
        offsetCents: 1200,
      });
      expect(findNearestString(200, [highString, lowString])).toEqual({
        string: highString,
        offsetCents: -1200,
      });
    });

    it("throws for a tuning with no strings", () => {
      expect(() => findNearestString(110, [])).toThrow(RangeError);
    });
  });

  it.each([0, -110, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws for %d Hz, which is not a pitch",
    (frequencyHz) => {
      expect(() => findNearestString(frequencyHz)).toThrow(RangeError);
    },
  );
});

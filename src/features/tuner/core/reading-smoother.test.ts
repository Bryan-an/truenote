import { describe, expect, it } from "vitest";
import { SMOOTHING_WINDOW_SIZE } from "./constants";
import {
  createReadingSmoother,
  type ReadingSmoother,
} from "./reading-smoother";

function pushAll(
  smoother: ReadingSmoother,
  readings: readonly number[],
): number[] {
  return readings.map((frequencyHz) => smoother.push(frequencyHz));
}

describe("createReadingSmoother", () => {
  it("returns the first reading as it is", () => {
    const smoother = createReadingSmoother();

    expect(smoother.push(110)).toBe(110);
  });

  it("returns the median of the readings so far", () => {
    const smoother = createReadingSmoother();

    expect(pushAll(smoother, [110, 111, 109]).at(-1)).toBe(110);
  });

  // YIN can jump an octave for a frame or two, most often on the low E string.
  it("never shows a single octave spike", () => {
    const smoother = createReadingSmoother();

    const smoothed = pushAll(smoother, [110, 110, 220, 110, 110]);

    expect(smoothed).not.toContain(220);
    expect(smoothed.at(-1)).toBe(110);
  });

  it("counts only the last 5 readings", () => {
    const smoother = createReadingSmoother();

    const smoothed = pushAll(
      smoother,
      [300, 300, 300, 300, 300, 100, 100, 100],
    );

    expect(SMOOTHING_WINDOW_SIZE).toBe(5);
    expect(smoothed.at(-1)).toBe(100);
  });

  it("returns the mean of the two middle readings for an even count", () => {
    const smoother = createReadingSmoother();

    expect(pushAll(smoother, [100, 102]).at(-1)).toBe(101);
  });

  it("forgets its history on reset", () => {
    const smoother = createReadingSmoother();
    pushAll(smoother, [110, 110, 110]);

    smoother.reset();

    expect(smoother.push(200)).toBe(200);
  });

  it("counts only the last readings of a custom window size", () => {
    const smoother = createReadingSmoother(3);

    expect(pushAll(smoother, [300, 300, 300, 100, 100]).at(-1)).toBe(100);
  });

  it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws for a window size of %d",
    (windowSize) => {
      expect(() => createReadingSmoother(windowSize)).toThrow(RangeError);
    },
  );

  it.each([0, -110, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws for %d Hz, which is not a pitch, and keeps its history",
    (frequencyHz) => {
      const smoother = createReadingSmoother();
      pushAll(smoother, [110, 110]);

      expect(() => smoother.push(frequencyHz)).toThrow(RangeError);
      expect(smoother.push(220)).toBe(110);
    },
  );
});

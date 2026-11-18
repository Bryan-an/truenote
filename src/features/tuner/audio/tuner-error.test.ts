import { describe, expect, it } from "vitest";
import { TUNER_ERROR, toTunerError } from "./tuner-error";

describe("toTunerError", () => {
  it.each(["NotAllowedError", "SecurityError"])(
    "maps a DOMException named %s to permission denied",
    (name) => {
      const error = new DOMException("The request is not allowed", name);

      expect(toTunerError(error)).toBe(TUNER_ERROR.PERMISSION_DENIED);
    },
  );

  it.each([
    "NotFoundError",
    "NotReadableError",
    "OverconstrainedError",
    "AbortError",
  ])("maps a DOMException named %s to microphone unavailable", (name) => {
    const error = new DOMException("The microphone failed", name);

    expect(toTunerError(error)).toBe(TUNER_ERROR.MICROPHONE_UNAVAILABLE);
  });

  it("maps a plain Error to microphone unavailable", () => {
    expect(toTunerError(new Error("Something broke"))).toBe(
      TUNER_ERROR.MICROPHONE_UNAVAILABLE,
    );
  });

  it("maps a thrown string to microphone unavailable", () => {
    expect(toTunerError("NotAllowedError")).toBe(
      TUNER_ERROR.MICROPHONE_UNAVAILABLE,
    );
  });

  it("never reports unsupported, which is known before asking", () => {
    const errors: unknown[] = [
      new DOMException("", "NotSupportedError"),
      new TypeError("navigator.mediaDevices is undefined"),
      null,
      undefined,
    ];

    for (const error of errors) {
      expect(toTunerError(error)).toBe(TUNER_ERROR.MICROPHONE_UNAVAILABLE);
    }
  });
});

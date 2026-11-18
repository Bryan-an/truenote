import { afterEach, describe, expect, it, vi } from "vitest";
import { MICROPHONE_CONSTRAINTS } from "./constants";
import { isAudioSupported, requestMicrophone } from "./microphone";

class FakeAudioContext {}

function stubMediaDevices(getUserMedia: unknown = vi.fn()): void {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isAudioSupported", () => {
  it("is false without mediaDevices", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("AudioContext", FakeAudioContext);

    expect(isAudioSupported()).toBe(false);
  });

  it("is false without getUserMedia", () => {
    vi.stubGlobal("navigator", { mediaDevices: {} });
    vi.stubGlobal("AudioContext", FakeAudioContext);

    expect(isAudioSupported()).toBe(false);
  });

  it("is false without AudioContext", () => {
    stubMediaDevices();
    vi.stubGlobal("AudioContext", undefined);

    expect(isAudioSupported()).toBe(false);
  });

  it("is true with mediaDevices and AudioContext", () => {
    stubMediaDevices();
    vi.stubGlobal("AudioContext", FakeAudioContext);

    expect(isAudioSupported()).toBe(true);
  });
});

describe("requestMicrophone", () => {
  it("asks for the raw input, with voice processing off", () => {
    expect(MICROPHONE_CONSTRAINTS).toEqual({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
  });

  it("calls getUserMedia exactly once with the microphone constraints", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    stubMediaDevices(getUserMedia);

    await expect(requestMicrophone()).resolves.toBe(stream);

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(MICROPHONE_CONSTRAINTS);
  });

  it("calls getUserMedia before returning, so it runs inside the tap", () => {
    const getUserMedia = vi.fn().mockResolvedValue({});
    stubMediaDevices(getUserMedia);

    void requestMicrophone();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("rejects with the browser's error when the microphone is refused", async () => {
    const error = new DOMException("Permission denied", "NotAllowedError");
    stubMediaDevices(vi.fn().mockRejectedValue(error));

    await expect(requestMicrophone()).rejects.toBe(error);
  });

  it("rejects instead of throwing when mediaDevices is missing", async () => {
    vi.stubGlobal("navigator", {});

    await expect(requestMicrophone()).rejects.toBeInstanceOf(TypeError);
  });
});

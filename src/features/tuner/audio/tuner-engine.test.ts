import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STRING_ID } from "../core/standard-tuning";
import { createSineWave } from "../core/testing/synthetic-signals";
import { ANALYSER_FFT_SIZE, MICROPHONE_CONSTRAINTS } from "./constants";
import { installFakeAudio } from "./testing/fake-audio";
import { TUNER_ERROR } from "./tuner-error";
import {
  createTunerEngine,
  IDLE_SNAPSHOT,
  TUNER_STATUS,
  type TunerEngine,
  type TunerStatus,
} from "./tuner-engine";

const SAMPLE_RATE = 48_000;
const A_STRING_HZ = 110;
const LOW_E_STRING_HZ = 82.41;
// Long enough for a handful of animation frames.
const A_FEW_FRAMES_MS = 100;

const A_STRING_SINE = createSineWave({
  frequencyHz: A_STRING_HZ,
  sampleRate: SAMPLE_RATE,
});

function recordStatuses(engine: TunerEngine): TunerStatus[] {
  const statuses: TunerStatus[] = [];

  engine.subscribe(() => {
    statuses.push(engine.getSnapshot().status);
  });

  return statuses;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createTunerEngine", () => {
  it("starts idle", () => {
    installFakeAudio();

    const engine = createTunerEngine();

    expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);

    expect(IDLE_SNAPSHOT).toEqual({
      status: TUNER_STATUS.IDLE,
      error: null,
      reading: null,
      diagnostics: null,
    });
  });

  it("touches no audio until it is started", () => {
    const audio = installFakeAudio();

    createTunerEngine();

    expect(audio.contexts).toHaveLength(0);
    expect(audio.getUserMedia).not.toHaveBeenCalled();
  });

  describe("start", () => {
    it("creates the AudioContext before awaiting the microphone", () => {
      const audio = installFakeAudio({ deferMicrophone: true });
      const engine = createTunerEngine();

      void engine.start();

      // iOS needs all of this to happen synchronously, inside the tap.
      expect(audio.contexts).toHaveLength(1);
      expect(audio.contexts[0].resume).toHaveBeenCalledTimes(1);
      expect(audio.getUserMedia).toHaveBeenCalledTimes(1);
      expect(audio.getUserMedia).toHaveBeenCalledWith(MICROPHONE_CONSTRAINTS);

      expect(engine.getSnapshot().status).toBe(
        TUNER_STATUS.REQUESTING_PERMISSION,
      );
    });

    it("requests the microphone and listens", async () => {
      installFakeAudio();

      const engine = createTunerEngine();
      const statuses = recordStatuses(engine);

      await engine.start();

      expect(statuses).toEqual([
        TUNER_STATUS.REQUESTING_PERMISSION,
        TUNER_STATUS.LISTENING,
      ]);

      expect(engine.getSnapshot()).toEqual({
        status: TUNER_STATUS.LISTENING,
        error: null,
        reading: null,
        diagnostics: null,
      });
    });

    it("reads the microphone through an analyser that is not played back", async () => {
      const audio = installFakeAudio();
      const engine = createTunerEngine();

      await engine.start();

      const [context] = audio.contexts;
      const [source] = context.sources;
      const [analyser] = context.analysers;

      expect(analyser.fftSize).toBe(ANALYSER_FFT_SIZE);
      expect(source.connect).toHaveBeenCalledTimes(1);
      expect(source.connect).toHaveBeenCalledWith(analyser);
      // Nothing reaches the destination, so the speaker cannot feed back into the microphone.
      expect(analyser.connect).not.toHaveBeenCalled();
    });

    it("ignores a second start while starting (Review Focus)", async () => {
      const audio = installFakeAudio({ deferMicrophone: true });
      const engine = createTunerEngine();

      const firstStart = engine.start();
      const secondStart = engine.start();

      audio.resolveMicrophone();
      await Promise.all([firstStart, secondStart]);

      expect(audio.getUserMedia).toHaveBeenCalledTimes(1);
      expect(audio.contexts).toHaveLength(1);
      expect(audio.tracks).toHaveLength(1);
      expect(engine.getSnapshot().status).toBe(TUNER_STATUS.LISTENING);
    });

    it("ignores a start while listening", async () => {
      const audio = installFakeAudio();
      const engine = createTunerEngine();

      await engine.start();

      const statuses = recordStatuses(engine);

      await engine.start();

      expect(audio.getUserMedia).toHaveBeenCalledTimes(1);
      expect(audio.contexts).toHaveLength(1);
      expect(statuses).toEqual([]);
    });
  });

  describe("while listening", () => {
    it("reports the played string", async () => {
      const audio = installFakeAudio({ sampleRate: SAMPLE_RATE });
      const engine = createTunerEngine();

      audio.setInput(A_STRING_SINE);
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      const { status, reading, diagnostics } = engine.getSnapshot();

      expect(status).toBe(TUNER_STATUS.LISTENING);
      expect(reading?.string.id).toBe(STRING_ID.A);
      expect(reading?.offsetCents).toBeCloseTo(0, 0);
      expect(diagnostics?.frequencyHz).toBeCloseTo(A_STRING_HZ, 1);
      expect(diagnostics?.clarity).toBeGreaterThan(0.9);
      expect(diagnostics?.rmsLevel).toBeGreaterThan(0);
      expect(diagnostics?.sampleRateHz).toBe(SAMPLE_RATE);
      expect(diagnostics?.microphoneSettings.echoCancellation).toBe(false);
      expect(audio.tracks[0].getSettings).toHaveBeenCalled();
    });

    it("uses the context's sample rate, whatever it is", async () => {
      const sampleRate = 44_100;
      const audio = installFakeAudio({ sampleRate });
      const engine = createTunerEngine();

      audio.setInput(createSineWave({ frequencyHz: A_STRING_HZ, sampleRate }));
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      const { reading, diagnostics } = engine.getSnapshot();

      expect(reading?.string.id).toBe(STRING_ID.A);
      expect(diagnostics?.frequencyHz).toBeCloseTo(A_STRING_HZ, 1);
      expect(diagnostics?.sampleRateHz).toBe(sampleRate);
    });

    it("reports no reading for silence", async () => {
      installFakeAudio();

      const engine = createTunerEngine();

      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      const { status, reading, diagnostics } = engine.getSnapshot();

      expect(status).toBe(TUNER_STATUS.LISTENING);
      expect(reading).toBeNull();
      expect(diagnostics?.frequencyHz).toBeNull();
      expect(diagnostics?.rmsLevel).toBe(0);
    });

    it("follows the input from one string to another", async () => {
      const audio = installFakeAudio({ sampleRate: SAMPLE_RATE });
      const engine = createTunerEngine();

      audio.setInput(A_STRING_SINE);
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      audio.setInput(
        createSineWave({
          frequencyHz: LOW_E_STRING_HZ,
          sampleRate: SAMPLE_RATE,
        }),
      );
      // The smoother's median needs a few frames to move to the new pitch.
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      expect(engine.getSnapshot().reading?.string.id).toBe(STRING_ID.LOW_E);
    });

    it("drops the old readings after a silence", async () => {
      const audio = installFakeAudio({ sampleRate: SAMPLE_RATE });
      const engine = createTunerEngine();

      audio.setInput(A_STRING_SINE);
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      audio.setInput(new Float32Array(ANALYSER_FFT_SIZE));
      vi.advanceTimersToNextFrame();

      audio.setInput(
        createSineWave({
          frequencyHz: LOW_E_STRING_HZ,
          sampleRate: SAMPLE_RATE,
        }),
      );
      vi.advanceTimersToNextFrame();

      // One frame is enough: the median no longer holds the readings of the A.
      expect(engine.getSnapshot().reading?.string.id).toBe(STRING_ID.LOW_E);
    });

    it("publishes a snapshot on every frame", async () => {
      installFakeAudio();

      const engine = createTunerEngine();

      await engine.start();

      const listener = vi.fn();

      engine.subscribe(listener);
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("reports an error and releases everything when a frame cannot be analysed", async () => {
      const audio = installFakeAudio();
      const engine = createTunerEngine();

      await engine.start();

      const [context] = audio.contexts;
      const [analyser] = context.analysers;

      analyser.getFloatTimeDomainData.mockImplementation(() => {
        throw new Error("The analyser failed");
      });
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      expect(engine.getSnapshot()).toEqual({
        status: TUNER_STATUS.ERROR,
        error: TUNER_ERROR.MICROPHONE_UNAVAILABLE,
        reading: null,
        diagnostics: null,
      });

      expect(audio.tracks[0].stop).toHaveBeenCalledTimes(1);
      expect(context.close).toHaveBeenCalledTimes(1);
      // The failed frame was the last one.
      expect(analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors", () => {
    it("reports permission denied", async () => {
      const audio = installFakeAudio({
        microphoneError: new DOMException("Denied", "NotAllowedError"),
      });
      const engine = createTunerEngine();

      await engine.start();

      expect(engine.getSnapshot()).toEqual({
        status: TUNER_STATUS.ERROR,
        error: TUNER_ERROR.PERMISSION_DENIED,
        reading: null,
        diagnostics: null,
      });

      expect(audio.contexts[0].close).toHaveBeenCalledTimes(1);
    });

    it("reports an unavailable microphone", async () => {
      const audio = installFakeAudio({
        microphoneError: new DOMException("No microphone", "NotFoundError"),
      });
      const engine = createTunerEngine();

      await engine.start();

      expect(engine.getSnapshot().status).toBe(TUNER_STATUS.ERROR);

      expect(engine.getSnapshot().error).toBe(
        TUNER_ERROR.MICROPHONE_UNAVAILABLE,
      );

      expect(audio.contexts[0].close).toHaveBeenCalledTimes(1);
    });

    it("reports unsupported when getUserMedia is missing", async () => {
      const audio = installFakeAudio();

      vi.stubGlobal("navigator", {});

      const engine = createTunerEngine();
      const statuses = recordStatuses(engine);

      await engine.start();

      expect(engine.getSnapshot()).toEqual({
        status: TUNER_STATUS.ERROR,
        error: TUNER_ERROR.UNSUPPORTED,
        reading: null,
        diagnostics: null,
      });

      // It never got as far as asking.
      expect(statuses).toEqual([TUNER_STATUS.ERROR]);
      expect(audio.contexts).toHaveLength(0);
    });

    it("reports unsupported when AudioContext is missing", async () => {
      const audio = installFakeAudio();

      vi.stubGlobal("AudioContext", undefined);

      const engine = createTunerEngine();

      await engine.start();

      expect(engine.getSnapshot().error).toBe(TUNER_ERROR.UNSUPPORTED);
      expect(audio.getUserMedia).not.toHaveBeenCalled();
    });

    it("releases the microphone when the audio graph cannot be built", async () => {
      const audio = installFakeAudio({ deferMicrophone: true });
      const engine = createTunerEngine();
      const start = engine.start();

      audio.contexts[0].createAnalyser.mockImplementation(() => {
        throw new Error("The analyser could not be created");
      });
      audio.resolveMicrophone();
      await start;

      expect(engine.getSnapshot().status).toBe(TUNER_STATUS.ERROR);

      expect(engine.getSnapshot().error).toBe(
        TUNER_ERROR.MICROPHONE_UNAVAILABLE,
      );

      expect(audio.tracks[0].stop).toHaveBeenCalledTimes(1);
      expect(audio.contexts[0].close).toHaveBeenCalledTimes(1);
    });

    it("can start again after an error", async () => {
      installFakeAudio({
        microphoneError: new DOMException("Denied", "NotAllowedError"),
      });

      const engine = createTunerEngine();

      await engine.start();

      expect(engine.getSnapshot().status).toBe(TUNER_STATUS.ERROR);

      // The user allowed the microphone in the settings and tapped "Try again".
      const audio = installFakeAudio({ sampleRate: SAMPLE_RATE });

      audio.setInput(A_STRING_SINE);
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      const { status, error, reading } = engine.getSnapshot();

      expect(status).toBe(TUNER_STATUS.LISTENING);
      expect(error).toBeNull();
      expect(reading?.string.id).toBe(STRING_ID.A);
      expect(audio.contexts).toHaveLength(1);
    });
  });

  describe("stop", () => {
    it("releases the microphone and returns to idle", async () => {
      const audio = installFakeAudio({ sampleRate: SAMPLE_RATE });
      const engine = createTunerEngine();

      audio.setInput(A_STRING_SINE);
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      const [context] = audio.contexts;
      const [source] = context.sources;
      const [analyser] = context.analysers;
      const framesBeforeStop =
        analyser.getFloatTimeDomainData.mock.calls.length;

      engine.stop();

      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(audio.tracks[0].stop).toHaveBeenCalledTimes(1);
      expect(audio.tracks[0].readyState).toBe("ended");
      expect(source.disconnect).toHaveBeenCalledTimes(1);
      expect(analyser.disconnect).toHaveBeenCalledTimes(1);
      expect(context.close).toHaveBeenCalledTimes(1);
      expect(context.state).toBe("closed");

      const listener = vi.fn();

      engine.subscribe(listener);
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      expect(framesBeforeStop).toBeGreaterThan(0);

      expect(analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(
        framesBeforeStop,
      );

      expect(listener).not.toHaveBeenCalled();
    });

    it("releases a stream that arrives after stop (Review Focus)", async () => {
      const audio = installFakeAudio({ deferMicrophone: true });
      const engine = createTunerEngine();

      const start = engine.start();

      engine.stop();

      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(audio.contexts[0].close).toHaveBeenCalledTimes(1);

      audio.resolveMicrophone();
      await start;

      expect(audio.tracks).toHaveLength(1);
      expect(audio.tracks[0].stop).toHaveBeenCalledTimes(1);
      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
      // The late stream never reached the audio graph.
      expect(audio.contexts[0].createMediaStreamSource).not.toHaveBeenCalled();

      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
    });

    it("stays idle when the microphone is refused after stop", async () => {
      const audio = installFakeAudio({
        deferMicrophone: true,
        microphoneError: new DOMException("Denied", "NotAllowedError"),
      });
      const engine = createTunerEngine();

      const start = engine.start();

      engine.stop();
      audio.resolveMicrophone();
      await start;

      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(audio.contexts[0].close).toHaveBeenCalledTimes(1);
    });

    it("keeps only the newest stream when restarted while the prompt is open (Review Focus)", async () => {
      const audio = installFakeAudio({ deferMicrophone: true });
      const engine = createTunerEngine();

      const firstStart = engine.start();

      engine.stop();

      const secondStart = engine.start();

      audio.resolveMicrophone();
      await Promise.all([firstStart, secondStart]);

      const [firstTrack, secondTrack] = audio.tracks;
      const [firstContext, secondContext] = audio.contexts;

      expect(audio.tracks).toHaveLength(2);
      expect(firstTrack.stop).toHaveBeenCalledTimes(1);
      expect(secondTrack.stop).not.toHaveBeenCalled();
      expect(firstContext.state).toBe("closed");
      expect(firstContext.createMediaStreamSource).not.toHaveBeenCalled();
      expect(secondContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
      expect(engine.getSnapshot().status).toBe(TUNER_STATUS.LISTENING);
    });

    it("tolerates a context that fails to close", async () => {
      const audio = installFakeAudio();
      const engine = createTunerEngine();

      await engine.start();

      // A plain function, because a `vi.fn` handles the rejections of what it returns.
      Object.defineProperty(audio.contexts[0], "close", {
        value: () =>
          Promise.reject(new DOMException("Closed", "InvalidStateError")),
      });
      engine.stop();

      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(audio.tracks[0].stop).toHaveBeenCalledTimes(1);
      // Vitest fails the run on an unhandled rejection, so there is nothing more to assert.
    });

    it("forgets the last reading, so a restart begins clean", async () => {
      const audio = installFakeAudio({ sampleRate: SAMPLE_RATE });
      const engine = createTunerEngine();

      audio.setInput(A_STRING_SINE);
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);
      engine.stop();

      audio.setInput(new Float32Array(ANALYSER_FFT_SIZE));
      await engine.start();
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      expect(audio.contexts).toHaveLength(2);
      expect(engine.getSnapshot().status).toBe(TUNER_STATUS.LISTENING);
      // Without the reset, the old A would stay on screen for the pitch hold time.
      expect(engine.getSnapshot().reading).toBeNull();
    });

    it("returns to idle from an error", async () => {
      installFakeAudio({
        microphoneError: new DOMException("Denied", "NotAllowedError"),
      });

      const engine = createTunerEngine();

      await engine.start();
      engine.stop();

      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
    });

    it("does nothing when already idle", () => {
      installFakeAudio();

      const engine = createTunerEngine();
      const listener = vi.fn();

      engine.subscribe(listener);
      engine.stop();

      expect(listener).not.toHaveBeenCalled();
      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
    });

    it("can be called from a subscriber in the middle of a frame", async () => {
      const audio = installFakeAudio();
      const engine = createTunerEngine();

      await engine.start();

      engine.subscribe(() => {
        if (engine.getSnapshot().diagnostics !== null) {
          engine.stop();
        }
      });
      vi.advanceTimersByTime(A_FEW_FRAMES_MS);

      const [analyser] = audio.contexts[0].analysers;

      expect(engine.getSnapshot()).toBe(IDLE_SNAPSHOT);
      expect(analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe and getSnapshot", () => {
    it("notifies subscribers until they unsubscribe", async () => {
      installFakeAudio();

      const engine = createTunerEngine();
      const listener = vi.fn();
      const otherListener = vi.fn();
      const unsubscribe = engine.subscribe(listener);

      engine.subscribe(otherListener);
      await engine.start();

      // Once for "requesting permission" and once for "listening".
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      engine.stop();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(otherListener).toHaveBeenCalledTimes(3);
    });

    it("keeps the same snapshot object until something changes", async () => {
      installFakeAudio();

      const engine = createTunerEngine();
      const idleSnapshot = engine.getSnapshot();

      expect(engine.getSnapshot()).toBe(idleSnapshot);

      await engine.start();

      const listeningSnapshot = engine.getSnapshot();

      expect(listeningSnapshot).not.toBe(idleSnapshot);
      expect(engine.getSnapshot()).toBe(listeningSnapshot);

      vi.advanceTimersToNextFrame();

      const frameSnapshot = engine.getSnapshot();

      expect(frameSnapshot).not.toBe(listeningSnapshot);
      expect(engine.getSnapshot()).toBe(frameSnapshot);
    });
  });
});

import { analyzePitch, type PitchAnalysis } from "../core/detect-pitch";
import { createReadingSmoother } from "../core/reading-smoother";
import {
  INITIAL_TUNING_STATE,
  updateTuningState,
  type TuningReading,
} from "../core/tuning-state";
import { ANALYSER_FFT_SIZE } from "./constants";
import { isAudioSupported, requestMicrophone } from "./microphone";
import { TUNER_ERROR, toTunerError, type TunerError } from "./tuner-error";

export const TUNER_STATUS = {
  IDLE: "idle",
  REQUESTING_PERMISSION: "requesting-permission",
  LISTENING: "listening",
  ERROR: "error",
} as const;

export type TunerStatus = (typeof TUNER_STATUS)[keyof typeof TUNER_STATUS];

// The raw detection data of the latest frame, for the diagnostics overlay.
export type TunerDiagnostics = {
  // The detected pitch before smoothing, or `null` when the frame had none.
  frequencyHz: number | null;
  clarity: number;
  rmsLevel: number;
  sampleRateHz: number;
  // What the browser actually applied, which can differ from what was asked for.
  microphoneSettings: MediaTrackSettings;
};

export type TunerSnapshot = {
  status: TunerStatus;
  error: TunerError | null;
  reading: TuningReading | null;
  // `null` until the first frame has been analysed.
  diagnostics: TunerDiagnostics | null;
};

export const IDLE_SNAPSHOT: TunerSnapshot = {
  status: TUNER_STATUS.IDLE,
  error: null,
  reading: null,
  diagnostics: null,
};

export type TunerEngine = {
  // Must be called from a tap: iOS only unlocks audio and the microphone inside a user gesture.
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): TunerSnapshot;
};

// The microphone stream and the nodes that read it. They exist only while listening.
type MicrophoneInput = {
  stream: MediaStream;
  nodes: AudioNode[];
};

export function createTunerEngine(): TunerEngine {
  const listeners = new Set<() => void>();
  const smoother = createReadingSmoother();
  // One buffer for every frame, so listening does not allocate 60 times a second.
  const samples = new Float32Array(ANALYSER_FFT_SIZE);

  let snapshot = IDLE_SNAPSHOT;
  let tuningState = INITIAL_TUNING_STATE;
  // Counts starts and stops. An async step that finds a different number than the one it began
  // with knows it was stopped or replaced in the meantime, and must not touch the engine.
  let session = 0;
  let context: AudioContext | null = null;
  let input: MicrophoneInput | null = null;
  let frameId: number | null = null;

  function publish(nextSnapshot: TunerSnapshot): void {
    snapshot = nextSnapshot;

    for (const listener of listeners) {
      listener();
    }
  }

  function publishStatus(
    status: TunerStatus,
    error: TunerError | null = null,
  ): void {
    publish({ status, error, reading: null, diagnostics: null });
  }

  // Ends the current session and lets go of the microphone and the audio hardware.
  function release(): void {
    session += 1;

    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }

    if (input !== null) {
      stopTracks(input.stream);

      for (const node of input.nodes) {
        node.disconnect();
      }

      input = null;
    }

    if (context !== null) {
      // Closing only fails on a context that is already closed, which is the goal anyway.
      context.close().catch(ignoreRejection);
      context = null;
    }

    smoother.reset();
    tuningState = INITIAL_TUNING_STATE;
  }

  function fail(error: unknown): void {
    release();
    publishStatus(TUNER_STATUS.ERROR, toTunerError(error));
  }

  // Reads the latest samples, moves the tuning state forward, and returns what was measured.
  function analyzeFrame(
    analyser: AnalyserNode,
    sampleRateHz: number,
    nowMs: number,
  ): PitchAnalysis {
    analyser.getFloatTimeDomainData(samples);

    const analysis = analyzePitch(samples, sampleRateHz);
    let smoothedFrequencyHz: number | null = null;

    // Readings from before a silence say nothing about the next note.
    if (analysis.frequencyHz === null) {
      smoother.reset();
    } else {
      smoothedFrequencyHz = smoother.push(analysis.frequencyHz);
    }

    tuningState = updateTuningState(tuningState, smoothedFrequencyHz, nowMs);

    return analysis;
  }

  function listen(
    listeningContext: AudioContext,
    analyser: AnalyserNode,
    microphoneSettings: MediaTrackSettings,
  ): void {
    const sampleRateHz = listeningContext.sampleRate;

    // The frame's timestamp is the clock for the in-tune rule.
    const processFrame = (nowMs: number): void => {
      // The next frame is booked first, so a `stop()` or a failure during this one cancels it.
      frameId = requestAnimationFrame(processFrame);

      let analysis: PitchAnalysis;

      try {
        analysis = analyzeFrame(analyser, sampleRateHz, nowMs);
      } catch (error) {
        // A frame that cannot be analysed must not leave the tuner silently dead.
        fail(error);

        return;
      }

      publish({
        status: TUNER_STATUS.LISTENING,
        error: null,
        reading: tuningState.reading,
        diagnostics: {
          frequencyHz: analysis.frequencyHz,
          clarity: analysis.clarity,
          rmsLevel: analysis.rmsLevel,
          sampleRateHz,
          microphoneSettings,
        },
      });
    };

    frameId = requestAnimationFrame(processFrame);
  }

  return {
    async start() {
      if (
        snapshot.status === TUNER_STATUS.REQUESTING_PERMISSION ||
        snapshot.status === TUNER_STATUS.LISTENING
      ) {
        return;
      }

      // `toTunerError` never answers "unsupported", so it is decided here, before asking.
      if (!isAudioSupported()) {
        publishStatus(TUNER_STATUS.ERROR, TUNER_ERROR.UNSUPPORTED);

        return;
      }

      session += 1;

      const startSession = session;

      // A failure that arrives after `stop()` has nothing left to release or report.
      const failThisSession = (error: unknown): void => {
        if (startSession === session) {
          fail(error);
        }
      };

      try {
        // iOS only unlocks audio inside the tap handler. Everything up to the `await` below runs
        // synchronously in it: creating the context, resuming it, and calling `getUserMedia`.
        const startingContext = new AudioContext();

        context = startingContext;
        // A context that cannot resume hears nothing, so the tuner must not sit in "listening".
        // Not awaited: `getUserMedia` has to be called in this same tap.
        startingContext.resume().catch(failThisSession);
        publishStatus(TUNER_STATUS.REQUESTING_PERMISSION);

        const stream = await requestMicrophone();

        // `stop()` ran while the permission prompt was open: this stream belongs to no one.
        if (startSession !== session) {
          stopTracks(stream);

          return;
        }

        input = { stream, nodes: [] };

        const source = startingContext.createMediaStreamSource(stream);
        const analyser = startingContext.createAnalyser();

        input.nodes.push(source, analyser);
        analyser.fftSize = ANALYSER_FFT_SIZE;
        // The analyser is not connected to the destination, so the microphone is never played
        // back through the speaker.
        source.connect(analyser);

        const [track] = stream.getAudioTracks();
        const microphoneSettings = track.getSettings();

        // The loop is booked before subscribers hear of it, so one that answers with `stop()`
        // cancels it.
        listen(startingContext, analyser, microphoneSettings);
        publishStatus(TUNER_STATUS.LISTENING);
      } catch (error) {
        failThisSession(error);
      }
    },

    stop() {
      release();

      if (snapshot !== IDLE_SNAPSHOT) {
        publish(IDLE_SNAPSHOT);
      }
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },
  };
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function ignoreRejection(): void {}

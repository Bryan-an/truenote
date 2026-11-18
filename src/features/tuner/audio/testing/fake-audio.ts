// Test-only stand-ins for the microphone and Web Audio, which jsdom does not implement.

import { vi, type Mock } from "vitest";

const DEFAULT_SAMPLE_RATE = 48_000;
const DEFAULT_FFT_SIZE = 2048;

export class FakeMediaStreamTrack {
  readonly kind = "audio";
  readyState: MediaStreamTrackState = "live";

  readonly stop = vi.fn(() => {
    this.readyState = "ended";
  });

  // What a browser reports when it honours `MICROPHONE_CONSTRAINTS`.
  readonly getSettings = vi.fn((): MediaTrackSettings => ({
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  }));
}

export class FakeMediaStream {
  private readonly tracks: FakeMediaStreamTrack[];

  constructor(tracks: FakeMediaStreamTrack[]) {
    this.tracks = tracks;
  }

  getTracks(): FakeMediaStreamTrack[] {
    return [...this.tracks];
  }

  getAudioTracks(): FakeMediaStreamTrack[] {
    return [...this.tracks];
  }
}

export class FakeMediaStreamSourceNode {
  readonly stream: FakeMediaStream;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();

  constructor(stream: FakeMediaStream) {
    this.stream = stream;
  }
}

export class FakeAnalyserNode {
  fftSize = DEFAULT_FFT_SIZE;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();

  // Copies the current input into the buffer it is given, as a real analyser does with the latest
  // samples. Input shorter than the buffer leaves the rest silent.
  readonly getFloatTimeDomainData: Mock<(buffer: Float32Array) => void>;

  constructor(readInput: () => Float32Array) {
    this.getFloatTimeDomainData = vi.fn((buffer: Float32Array) => {
      buffer.fill(0);
      buffer.set(readInput().subarray(0, buffer.length));
    });
  }
}

export class FakeAudioContext {
  state: AudioContextState = "suspended";
  readonly sampleRate: number;
  readonly destination = {};
  readonly sources: FakeMediaStreamSourceNode[] = [];
  readonly analysers: FakeAnalyserNode[] = [];

  readonly resume = vi.fn(async () => {
    this.state = "running";
  });

  readonly close = vi.fn(async () => {
    this.state = "closed";
  });

  readonly createMediaStreamSource = vi.fn((stream: FakeMediaStream) => {
    const source = new FakeMediaStreamSourceNode(stream);

    this.sources.push(source);

    return source;
  });

  readonly createAnalyser = vi.fn(() => {
    const analyser = new FakeAnalyserNode(this.readInput);

    this.analysers.push(analyser);

    return analyser;
  });

  private readonly readInput: () => Float32Array;

  constructor(sampleRate: number, readInput: () => Float32Array) {
    this.sampleRate = sampleRate;
    this.readInput = readInput;
  }
}

export type FakeAudio = {
  getUserMedia: Mock<() => Promise<FakeMediaStream>>;
  // Every context the code under test created, in order.
  contexts: FakeAudioContext[];
  // The track of every stream the microphone handed out, in order.
  tracks: FakeMediaStreamTrack[];
  // What the microphone "hears" from now on. It starts as silence.
  setInput(samples: Float32Array): void;
  // With `deferMicrophone`, answers every request that is still waiting, like the user answering
  // the permission prompt.
  resolveMicrophone(): void;
};

export type FakeAudioOptions = {
  sampleRate?: number;
  // Makes every microphone request fail with this value.
  microphoneError?: unknown;
  // Leaves each microphone request pending until `resolveMicrophone()`.
  deferMicrophone?: boolean;
};

// Replaces `navigator` and `AudioContext` through `vi.stubGlobal`. The test file restores them
// with `vi.unstubAllGlobals()` in `afterEach`.
export function installFakeAudio({
  sampleRate = DEFAULT_SAMPLE_RATE,
  microphoneError,
  deferMicrophone = false,
}: FakeAudioOptions = {}): FakeAudio {
  const contexts: FakeAudioContext[] = [];
  const tracks: FakeMediaStreamTrack[] = [];
  const pendingRequests: (() => void)[] = [];
  const hasMicrophoneError = microphoneError !== undefined;
  let input: Float32Array = new Float32Array(DEFAULT_FFT_SIZE);

  class InstalledAudioContext extends FakeAudioContext {
    constructor() {
      super(sampleRate, () => input);
      contexts.push(this);
    }
  }

  // The stream and its track only exist once the request is answered, as in a browser.
  function answerRequest(
    resolve: (stream: FakeMediaStream) => void,
    reject: (reason: unknown) => void,
  ): void {
    if (hasMicrophoneError) {
      reject(microphoneError);

      return;
    }

    const track = new FakeMediaStreamTrack();

    tracks.push(track);
    resolve(new FakeMediaStream([track]));
  }

  const getUserMedia = vi.fn(
    () =>
      new Promise<FakeMediaStream>((resolve, reject) => {
        if (deferMicrophone) {
          pendingRequests.push(() => {
            answerRequest(resolve, reject);
          });
        } else {
          answerRequest(resolve, reject);
        }
      }),
  );

  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("AudioContext", InstalledAudioContext);

  return {
    getUserMedia,
    contexts,
    tracks,

    setInput(samples) {
      input = samples;
    },

    resolveMicrophone() {
      for (const answer of pendingRequests.splice(0)) {
        answer();
      }
    },
  };
}

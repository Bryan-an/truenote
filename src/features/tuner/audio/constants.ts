// The raw input, with no voice processing. Echo cancellation, noise suppression and automatic gain
// are made for speech and distort a sustained guitar note. On iOS, `echoCancellation: false` is also
// what selects the non-voice-processed microphone.
export const MICROPHONE_CONSTRAINTS = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  video: false,
} as const satisfies MediaStreamConstraints;

// Samples per analysed frame. At 44.1 and 48 kHz this holds two periods of the lowest pitch the
// detector looks for, which is what it needs to compare one period with the next.
export const ANALYSER_FFT_SIZE = 2048;

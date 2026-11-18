export const TUNER_ERROR = {
  PERMISSION_DENIED: "permission-denied",
  MICROPHONE_UNAVAILABLE: "microphone-unavailable",
  UNSUPPORTED: "unsupported",
} as const;

export type TunerError = (typeof TUNER_ERROR)[keyof typeof TUNER_ERROR];

// `SecurityError` is what a page gets when it is not allowed to ask at all, for example outside
// HTTPS. On iOS, WebKit bug 319706 also fails with `NotAllowedError` until the app is relaunched.
const PERMISSION_ERROR_NAMES: ReadonlySet<string> = new Set([
  "NotAllowedError",
  "SecurityError",
]);

// Maps whatever starting the audio threw to an error the screen can explain. `unsupported` is never
// returned here: it is known before asking, from `isAudioSupported`.
export function toTunerError(error: unknown): TunerError {
  if (error instanceof DOMException && PERMISSION_ERROR_NAMES.has(error.name)) {
    return TUNER_ERROR.PERMISSION_DENIED;
  }

  return TUNER_ERROR.MICROPHONE_UNAVAILABLE;
}

import { MICROPHONE_CONSTRAINTS } from "./constants";

// `mediaDevices` is missing in old browsers and outside a secure context (HTTPS or localhost).
export function isAudioSupported(): boolean {
  return (
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof globalThis.AudioContext === "function"
  );
}

// Shows the permission prompt the first time. Being `async`, it rejects instead of throwing when
// `mediaDevices` is missing, and it still calls `getUserMedia` synchronously, inside the tap.
export async function requestMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(MICROPHONE_CONSTRAINTS);
}

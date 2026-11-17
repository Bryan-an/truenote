import { centsBetween } from "./note-math";
import { STANDARD_TUNING, type GuitarString } from "./standard-tuning";

export type StringMatch = { string: GuitarString; offsetCents: number };

// Distances are compared in cents because pitch is heard as a ratio, not as a difference in Hz.
export function findNearestString(
  frequencyHz: number,
  tuning: readonly GuitarString[] = STANDARD_TUNING,
): StringMatch {
  let nearest: StringMatch | null = null;

  for (const string of tuning) {
    const offsetCents = centsBetween(frequencyHz, string.frequencyHz);

    // The strict comparison keeps the first string in tuning order on an exact tie.
    if (
      nearest === null ||
      Math.abs(offsetCents) < Math.abs(nearest.offsetCents)
    ) {
      nearest = { string, offsetCents };
    }
  }

  if (nearest === null) {
    throw new RangeError("Expected a tuning with at least one string");
  }

  return nearest;
}

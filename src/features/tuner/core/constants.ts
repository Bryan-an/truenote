// Twelve-tone equal temperament, tuned to A4 = 440 Hz.
export const REFERENCE_A4_HZ = 440;
export const A4_MIDI_NOTE = 69;
export const SEMITONES_PER_OCTAVE = 12;
export const CENTS_PER_OCTAVE = 1200;
export const OCTAVE_FREQUENCY_RATIO = 2;
export const MIN_MIDI_NOTE = 0;
export const MAX_MIDI_NOTE = 127;

// Pitch detection. The range covers a guitar with room to spare: low E is 82 Hz, high E is 330 Hz.
export const MIN_FREQUENCY_HZ = 60;
export const MAX_FREQUENCY_HZ = 1000;
// How deep a dip in YIN's normalized difference must be to count as a period.
export const YIN_THRESHOLD = 0.15;
// Input-level gate: anything quieter is treated as silence. Tuned on devices in Task 27.
export const MIN_RMS_LEVEL = 0.005;

// Smoothing. A median over this many readings drops a stray octave jump of one or two frames.
export const SMOOTHING_WINDOW_SIZE = 5;

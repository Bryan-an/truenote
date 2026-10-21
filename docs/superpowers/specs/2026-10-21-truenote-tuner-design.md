# truenote: guitar tuner design

- **Date:** 2026-10-21
- **Status:** approved by the owner on 2026-10-21
- **Scope:** version 1 (v1) of the tuner. Future features are listed but not designed here.

Items marked **(owner)** were decided explicitly by the project owner. Items marked **(Claude's call)** were proposed by Claude and accepted without objection; the owner may still revisit them. Anything not marked is a constraint of the platform or a direct consequence of those decisions.

## 1. Intent

The owner wants to tune their guitar with their own iPhone, for free, with an app they built themselves. The reference experience is GuitarTuna: it detects which string you are playing on its own and makes tuning easy.

truenote is a real project and also a learning project. The way it is built matters as much as the result:

- **Small steps:** each step is small and explained.
- **Small commits:** each commit is small and has a clear purpose.
- **Professional tooling:** linting, formatting, git hooks, tests, CI and preview deploys are set up from the start, not bolted on later.

### Why a web app (PWA) and not a native app (owner)

A native iOS app installed with a free Apple ID expires after 7 days and needs re-installing from Xcode. A web app has no such limit and costs nothing. The same code runs on iPhone (Safari) and Android (Chrome), and it can be added to the Home Screen and work offline.

## 2. Goals, non-goals, anti-goals

### Goals (v1)

1. **Tune a 6-string guitar** in standard tuning with the phone microphone. The target strings are E2 82.41 Hz, A2 110.00 Hz, D3 146.83 Hz, G3 196.00 Hz, B3 246.94 Hz and E4 329.63 Hz, with A4 = 440 Hz.
2. **Detect the string automatically:** the app picks the standard-tuning string closest, in cents, to the detected pitch (owner).
3. **Show the string on a guitar headstock:** a 3 + 3 headstock where the detected string and its peg light up (owner).
4. **Show tuning with an arc needle** from −50 to +50 cents relative to the detected string's target note (owner).
5. **Signal when the string is in tune:** the screen turns green and a short "ding" plays (owner).
6. **Run in Safari on iPhone** (tab and Home Screen) **and in Chrome on Android.**
7. **Be installable and work offline** as a PWA.
8. **Deploy for free** on Cloudflare Workers (owner).

### Non-goals (v1)

These are explicitly out of v1 and some are future candidates (see §11):

- **Alternate tunings:** Drop D, open tunings and the like. Standard tuning only (Claude's call).
- **Manual string selection:** auto mode only (Claude's call).
- **Other instruments:** no bass, ukulele or 7-string guitar.
- **Chromatic mode:** no tuning to any note outside the six strings.
- **Adjustable reference pitch:** A4 is fixed at 440 Hz (Claude's call).
- **Other features:** no metronome and no play-along/songs feature (owner: future).
- **No backend:** no accounts, analytics, tracking or ads.
- **Background use:** no listening with the screen locked or the app in the background. Browsers do not allow it.
- **Haptics:** no vibration. iOS Safari does not support it.
- **Translations:** no i18n. The UI is English only (Claude's call, following the owner's "everything in English" rule).

### Anti-goals (would make v1 a failure even if it "works")

- The needle jitters so much that it cannot be read.
- The low E (82.41 Hz) is not detected reliably.
- The user has to pick the string by hand.
- The page navigates or reloads during use, dropping the microphone stream and forcing a new permission prompt.
- Anything requires a paid Apple Developer account.

## 3. Success criteria

- **Real-world use:** the owner can tune all six strings of their guitar on their own iPhone with truenote, about as easily as with GuitarTuna. The guitar is a standard 6-string acoustic (owner), assumed to have steel strings. Its plucked notes start with a strong attack and have strong 2nd and 3rd harmonics, so the detector must lock onto the fundamental, not an octave above it.
- **Detection accuracy:** on synthetic test signals between 70 Hz and 400 Hz (pure tones and harmonic-rich tones), the detected frequency is within ±1 cent of the true frequency (Claude's call).
- **No false readings:** silence and noise produce "no pitch" rather than a random note.
- **Automated quality gates:**
  - All automated checks pass: lint, format check, type check, tests with coverage of at least 80%, and build.
  - The manual device checklist (§9) passes on an iPhone.

## 4. User experience

One screen, no navigation. The only states shown are the ones below.

### 4.1 Screen layout (owner, from mockups)

From top to bottom:

1. **Header:** the app name "truenote" and the current tuning, "Standard · E A D G B E".
2. **Arc needle meter:**
   - The scale runs from −50 to +50 cents, with ♭ on the left and ♯ on the right.
   - A green zone at the centre marks the in-tune range.
   - The needle pivots at the bottom centre.
3. **Note display:** the note name in large text with its octave as a small suffix (for example "A₂"). Below it, a status line with the cents offset and a hint: "tune up" when the string is flat (tighten it), "tune down" when it is sharp (loosen it).
4. **3 + 3 headstock:**
   - **Pegs:** three per side with letter labels. Left side, top to bottom: E, A, D (strings 6, 5, 4). Right side, top to bottom: E, B, G (strings 1, 2, 3).
   - **Strings:** drawn from the nut to their posts.
   - **Highlight:** the detected string's line and its peg light up.

The approved mockup is committed at `docs/superpowers/specs/assets/2026-10-21-tuner-screen-mockup.html`. It is a layout sketch, not final visual design.

### 4.2 States

| State | What the user sees |
|---|---|
| **Idle** (Claude's call) | Everything is grey, with a "Tap to start" button. It is needed because iOS only allows microphone and audio start-up after a user gesture. |
| **Requesting permission** | The OS microphone prompt is shown over the idle screen. |
| **Listening, no pitch** | The needle is at rest (centre, grey) and the note shows "–". No string is highlighted. |
| **Listening, out of tune** | The detected string and peg are orange, the needle shows the offset, and the hint says "tune up" or "tune down". If the offset is beyond ±50 cents, the needle stays pinned at the edge. |
| **In tune** | The string, peg, needle and note turn green, the status line reads "In tune ✓", and the ding plays. |
| **Error** | There is a short explanation and a retry action. Cases: permission denied (how to re-enable it in settings), microphone unavailable or failed ("close and reopen the app"), and unsupported browser. |
| **Resumed** | After the app was backgrounded or the screen was locked, the app returns to Idle or recovers listening on the next tap. It must never be left silently dead. |

### 4.3 Colours (Claude's call)

- **Grey:** idle or no pitch.
- **Orange:** out of tune.
- **Green:** in tune.

Colours are defined as theme tokens (§6.4), never as raw values in components.

### 4.4 In-tune rule (Claude's call)

- **Entering in tune:** a string is in tune when its offset stays within ±5 cents (`IN_TUNE_TOLERANCE_CENTS`) continuously for about 0.5 s (`IN_TUNE_HOLD_MS`). The hold stops the green state flickering.
- **Leaving in tune (hysteresis):** a string only leaves the in-tune state when its offset goes beyond ±8 cents (`OUT_OF_TUNE_THRESHOLD_CENTS`). A string hovering around ±5 cents therefore does not flicker between states.
- **When the note fades:** after the pitch is lost (the string decays or is muted), the last reading and colours stay on screen for about 1.5 s (`PITCH_HOLD_MS`), so the result can be read. The screen then returns to "listening, no pitch".
- **Ding:** it plays once each time a string enters the in-tune state. It can play again after either of these:
  - the string leaves the in-tune state, as defined above
  - the pitch is lost and the string is plucked again (re-plucking a tuned string confirms it with a ding)

  It never repeats while a string keeps sounding in tune.

### 4.6 Diagnostics view (Claude's call)

A hidden overlay, enabled by adding `?debug` to the URL, shows the raw detection data:
- frequency in Hz
- detection clarity or confidence
- input level
- sample rate
- the microphone settings actually applied (`getSettings()`)

It is not a user-facing state and is not linked from the UI. Its purpose is to tune the detector's thresholds on real devices (§9) without blind redeploys.

### 4.5 Language

All UI text is in English.

## 5. Platform constraints

These come from research done on 2026-10-21 and are not yet verified on a device. They shape the design.

### Secure context and start-up

- **HTTPS is required.** The microphone (`getUserMedia`) only works in a secure context. Testing on a phone during development needs HTTPS too (§8.3).
- **User gesture.** The `AudioContext` must be created or resumed from a user gesture, which is the "Tap to start" button.

### iOS Home Screen behaviour

- **Permission prompt on every cold launch.** When opened from the Home Screen, iOS asks for microphone permission again each time (WebKit bug 327237, iOS 26.6, open).
- **Single page.** The page must not navigate or reload while listening.
- **Wake lock.** The screen should be kept awake while listening (Screen Wake Lock). It works in Home Screen apps from iOS 18.4.
- **Audio is foreground only.** Capture stops when the app is backgrounded or the screen locks. The audio layer must handle `visibilitychange`, the `AudioContext` "interrupted"/"suspended" states, and track `mute`/`ended`, then recover or return to Idle.

### Microphone settings

- Request the mic with `echoCancellation: false`, `noiseSuppression: false` and `autoGainControl: false`. On iOS, `echoCancellation: false` selects the raw, non-voice-processed input.
- Read back `getSettings()` to see what was actually applied.
- **Sample rate.** Never assume the sample rate; read `audioContext.sampleRate`. It is usually 48 kHz on iPhone.

### Known iOS bugs

- **Ding output (WebKit bug 326286).** With the mic open, sound output on recent iOS can crackle, or go to the earpiece at low volume. The ding must be treated as best-effort, and the green visual state is always the primary signal. This is to be tested early on a real iPhone.
- **Permanent mic failure (WebKit bug 319706).** On iOS 26.3 to 26.6 the mic can fail with `NotAllowedError` until the app is relaunched. It is shown as an error with a "close and reopen" message.

### Other platforms

- **No vibration.** `navigator.vibrate` does not exist on iOS.
- **Android Chrome.** The mic path may apply voice processing even with the flags off. Low E detection must be verified on an Android phone.

## 6. Architecture

### 6.1 Folder structure (owner)

Feature-based, because a metronome and a songs feature may come later:

```
src/
├── app/                      entry point, App component, global styles
├── features/
│   └── tuner/
│       ├── core/             pure TypeScript: pitch detection, note/cents maths, tunings, string detection
│       ├── audio/            browser bridge: microphone, Web Audio, wake lock, lifecycle
│       └── ui/
│           ├── tuner-screen.tsx
│           ├── components/   presentational pieces, one folder each (e.g. needle/, headstock/, note-display/)
│           └── hooks/        use-tuner.ts
└── shared/                   code used by more than one feature (starts empty)
```

### 6.2 Dependency rules (owner)

1. Inside a feature, imports point inward only: `ui` may import from `audio` and `core`, `audio` may import from `core`, and `core` imports nothing from `audio` or `ui`.
2. `core` imports nothing from the browser or React. It is plain TypeScript that runs in Node.
3. A feature never imports from another feature. Shared code moves to `shared/`.
4. `shared/` never imports from `features/`.
5. Only `app/` composes features.

These rules are enforced by the linter (`no-restricted-imports` with per-folder overrides), not just by convention.

Code moves into `shared/` only when a second feature actually needs it, so `shared/` stays empty in v1 (Claude's call).

### 6.3 Layer responsibilities

**`core`**

- Pitch detection. Its signature is `detectPitch(samples: Float32Array, sampleRate: number): number | null` (frequency in Hz, or `null` when there is no clear pitch).
- Frequency to note name, octave and cents.
- The standard tuning definition.
- Nearest-string detection.
- The in-tune rule (tolerance and hold time).
- Smoothing of successive readings so the needle does not jitter.

**`audio`**

- **Microphone:** requesting it with the constraints in §5.
- **Analysis:** creating and resuming the `AudioContext` and reading sample buffers continuously while listening, then calling `core`.
- **Lifecycle:**
  - handling visibility changes and interruptions
  - acquiring and releasing the wake lock
  - playing the ding
- **Errors:** reporting them as typed states.
- **Interface:** exposes a small engine that the UI can start, stop and subscribe to.

**`ui`**

- **`useTuner`** subscribes to the engine and exposes the tuner state to components. The engine is injected (passed in), not created inside the hook, so tests can pass a fake engine (owner).
- **Components** are presentational: they only receive props and render.
- **`tuner-screen.tsx`** composes them.

**`app`**

- Creates the real engine, renders the screen, and registers the PWA service worker.

### 6.4 Code conventions (owner unless marked)

**Language and naming**

- **English everywhere:** identifiers, comments, docs, commit messages and UI text.
- **File and folder names:** always kebab-case, including components (`tuner-screen.tsx`) and hooks (`use-tuner.ts`). Component identifiers stay PascalCase (`TunerScreen`) because React requires it.
- **Identifiers:**
  - variables and functions in camelCase
  - types in PascalCase
  - module-level constants in UPPER_SNAKE_CASE
- **Units in names:** numeric values carry their unit in the name (`frequencyHz`, `offsetCents`, `IN_TUNE_HOLD_MS`).
- **Booleans** read as questions (`isListening`, `hasPermission`).
- **Exports:** named only, no default exports (Claude's call).

**Constants and types**

- **No magic numbers.** Meaningful numbers are named constants with units, kept next to the code that owns them (for example `features/tuner/core/constants.ts`). `no-magic-numbers` is enabled in the linter, except in test files.
- **No magic strings.** String values are written once in an `as const` object, and their type is derived from it:
  ```ts
  export const TUNER_STATUS = { IDLE: 'idle', LISTENING: 'listening', ERROR: 'error' } as const
  export type TunerStatus = (typeof TUNER_STATUS)[keyof typeof TUNER_STATUS]
  ```
  Code compares against `TUNER_STATUS.LISTENING`, never a bare `'listening'`.
- **No TypeScript `enum`.**

**Structure and styling**

- **DRY with the rule of three:** extract on the third repetition, not the second.
- **Lightweight atomic design:**
  - Small presentational components are composed into larger ones.
  - The atoms/molecules/organisms folders are not used.
  - Each component has its own folder with the component and its test.
  - Generic pieces move to `shared/ui/` when a second feature needs them.
- **Tailwind CSS for styling.**
  - Colours, spacing and other design values are theme tokens (for example an `in-tune` colour), used as `text-in-tune`.
  - Arbitrary values such as `text-[#3f3]` or `w-[37px]` are not allowed, because they are the styling equivalent of magic numbers.
  - The needle angle changes many times per second. It is written to a CSS variable through a ref, not through React state or the JSX `style` prop, and a Tailwind class consumes it (Claude's call).

### 6.5 How conventions are enforced (Claude's call)

Oxlint is the only linter (owner). No ESLint is added. Where Oxlint, or one of its JS plugins, has a rule, the convention is machine-enforced. Otherwise it is enforced by TypeScript or by review.

| Convention | Enforced by |
|---|---|
| Layer and feature import rules | Oxlint `no-restricted-imports` with per-folder overrides |
| No magic numbers | Oxlint `no-magic-numbers` (off in test files) |
| Tailwind: no arbitrary values, no hard-coded colours, no unknown classes | The `oxlint-tailwindcss` JS plugin. The fallback is `eslint-plugin-better-tailwindcss` loaded as an Oxlint JS plugin. Oxlint JS plugins are alpha. |
| Tailwind class order | `prettier-plugin-tailwindcss` |
| kebab-case file names | Oxlint `unicorn/filename-case`, if available; otherwise review |
| No default exports | Oxlint `import/no-default-export`, with overrides for config files that require a default export |
| No `enum` | The TypeScript compiler option `erasableSyntaxOnly` |
| Promises handled in async audio code | Oxlint type-aware rules |
| No magic strings, UPPER_SNAKE constants | TypeScript (derived literal types) and review |

Type-aware linting needs the whole program. It therefore always runs on the full project in `pre-push` and CI. The `pre-commit` hook may run only the fast, non-type-aware rules on staged files if type-aware linting is too slow there; the builder decides based on measured speed.

## 7. Testing (owner unless marked)

- **Tools:**
  - Vitest, with the `node` environment for `core`
  - `jsdom` plus React Testing Library for `ui`
- **`core` is built test-first (TDD):** red, then green, then refactor. Tests use synthetic signals generated in code:
  - pure tones at each string's frequency and in between
  - harmonic-rich tones that resemble a plucked string
  - silence and noise, which must return `null`
  - Assertions use the ±1 cent accuracy target from §3.
- **`audio` and `ui` are tested right after the code.**
  - `audio`: mocks of `navigator.mediaDevices` and `AudioContext`, mainly to cover error and lifecycle paths. Real behaviour is checked on devices.
  - `ui`: the screen and components rendered with a fake engine, checking what the user sees for each state in §4.2.
- **Test files sit next to the file they test** (`frequency-to-note.ts` and `frequency-to-note.test.ts`) (Claude's call).
- **Coverage of at least 80%** for lines, branches, functions and statements, enforced by the test command in the pre-push hook and in CI. Only files without logic (entry point, config) are excluded.
- **Deferred:** no end-to-end tests (Playwright) and no Vitest browser mode in v1.

## 8. Tooling and workflow (owner unless marked)

### 8.1 Stack

| Concern | Choice |
|---|---|
| Language and framework | TypeScript, React, Vite (scaffolded from the official `react-ts` template) |
| Runtime | Node 24 LTS, pinned in `.nvmrc` and `engines` |
| Package manager | pnpm 11 (owner), with its security defaults kept on (minimum release age, build scripts blocked unless allowed) and pinned via the `packageManager` field. pnpm 12 is not used yet. Its two-document lockfile is not read by GitHub's dependency graph, so Dependabot security alerts would see no dependencies. Revisit when that is fixed. |
| Styling | Tailwind CSS |
| Linting | Oxlint with type-aware rules (at least `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`), React hooks rules, jsx-a11y, `no-magic-numbers`, and `no-restricted-imports` for the layer rules. Warnings fail the run. |
| Type checking | `tsc -b` (the linter does not replace it) |
| Formatting | Prettier with default settings plus `prettier-plugin-tailwindcss` for class order (Claude's call) |
| Tests | Vitest and React Testing Library, as in §7 |
| PWA | Web app manifest and service worker (vite-plugin-pwa or equivalent). An app update must never reload the page in the middle of a tuning session. |
| Hosting | Cloudflare Workers with static assets (assets only, single-page app fallback), built and deployed by Workers Builds from GitHub, with per-branch and per-PR Worker Previews. Previews are in open beta; production deploys do not depend on them. The Worker is named `truenote` and production lives on its `workers.dev` address (Claude's call). Changing the domain later changes the origin, which means re-installing the Home Screen app and granting the microphone again. |
| Repository | Public GitHub repository named `truenote` (owner). Being public, it gets branch protection and GitHub Actions minutes on the free plan. |

### 8.2 Git hooks and commits

- **Hooks (Husky):**
  - `pre-commit`: lint-staged runs Oxlint and Prettier on staged files only.
  - `commit-msg`: commitlint checks the message.
  - `pre-push`: the full lint run (including type-aware rules), `tsc -b` and the full test run with coverage.
- **Commit messages** follow Conventional Commits, in English and lowercase: `type(scope): description`, for example `feat(tuner): detect the string being played`. The scope is optional.
- **Hooks are a convenience, CI is the authority.** A GitHub Actions workflow runs on every pull request: install with a frozen lockfile, lint, format check, `tsc -b`, tests with coverage, build, and commitlint over the PR's commits. Branch protection on `main` requires it to pass.
- **Workflow:**
  1. One branch per step.
  2. A pull request into `main`, which triggers CI and a Cloudflare preview URL to open on the iPhone.
  3. The PR is merged with "Rebase and merge" so the small commits are kept on `main`.
- **Commit size:** small commits with one purpose each. The first commit holds the design document, its mockup and a `.gitignore` that excludes tool folders (`.superpowers/`, `.remember/`).
- **Explanations:** each step is explained to the owner in the conversation (in Spanish) before or while it is done. Everything that lands in the repository stays in English, including PR descriptions, which briefly summarise the step.

### 8.4 Who does what (Claude's call; the owner did not answer this one and may change it)

- **Claude** explains each step first. Then Claude writes the files, runs the commands, makes the commits, pushes the branch and opens the pull request with the `gh` CLI.
- **The owner** reviews each pull request and, when the step affects the app, its preview URL on the iPhone. Then the owner merges it, or explicitly asks Claude to merge it. Nothing reaches `main` without the owner's go-ahead.
- **Account-level steps that need the owner's own logins are done by the owner with guidance, or by Claude only after the owner confirms that specific step.** The owner already has a Cloudflare account. These steps are:
  - creating the public GitHub repository and the first push to it
  - connecting Cloudflare Workers Builds to the GitHub repository (installing the Cloudflare GitHub app on this repository only)
  - setting build environment variables in the Cloudflare dashboard
  - approving anything GitHub asks the owner to confirm
- **Branch protection on `main`:**
  - It requires the CI check to pass and a linear history (rebase merges only).
  - It does not require PR approvals, because a solo owner cannot approve their own PRs.
  - It is configured once the CI check has run for the first time, because the check's name only exists after that run.

### 8.3 Testing on a phone during development

The microphone needs HTTPS, so a phone on the local network cannot use the plain `http://` dev server. Options:

- A Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:5173`), which needs no account. Vite's `server.allowedHosts` must allow the tunnel host.
- The per-branch preview URL.

## 9. Manual device checklist

To be run on the owner's iPhone (Safari tab **and** Home Screen) and, when possible, on an Android phone with Chrome:

1. Tapping "Tap to start" shows the permission prompt. Granting it starts listening, and denying it shows the error state with guidance.
2. Each open string is detected as the right string and highlighted, including low E (82.41 Hz).
3. Tuning a detuned string up to pitch moves the needle smoothly. It turns green and plays the ding once.
4. Note whether the ding is audible and clean on the iPhone, or crackly or quiet (WebKit bug 326286).
5. The screen stays awake while listening.
6. Locking and unlocking the phone, or switching apps and coming back, recovers or returns to Idle, and never ends up silently dead.
7. Closing the Home Screen app and reopening it re-asks for permission (known iOS behaviour), and the app still works.
8. The app loads with no network after the first visit (offline).

The diagnostics view (§4.6) is used during these checks to tune detection thresholds against the owner's acoustic guitar.

Optionally, the owner can record a few seconds of each open string with the iPhone. Those clips become real-world test fixtures for `core`, alongside the synthetic signals (Claude's call: optional, not blocking).

## 10. Left to the builder

- **Pitch detection algorithm.**
  - Implement our own detector in `core` with TDD rather than depend on a pitch library (Claude's call, because `core` is meant to be learned and owned).
  - Which algorithm (YIN, McLeod/MPM or autocorrelation with interpolation) and its parameters (buffer size, thresholds, minimum and maximum frequency) are the builder's choice, as long as §3 is met.
- **Audio capture method:** an `AnalyserNode` (simplest) or an `AudioWorklet`.
- **Smoothing method** for the readings and the needle animation.
- **How the ding is produced:** a synthesised Web Audio tone or a small audio file.
- **Visuals:** the exact Tailwind tokens, sizes, typography, icons and visual polish within the layout of §4.1.
- **PWA details:** manifest contents, icons, update strategy (prompt rather than auto-reload during use), and caching headers.
- **Error copy:** the exact wording of error messages.
- **Version numbers:** exact versions of every dependency at install time. Recent versions from the 2026-10-21 research are a starting point, not a requirement.
- **Order of work:** setting up the repository and tooling before the tuner itself, in small steps, is expected.

## 11. Future features (not v1)

- Metronome (a new feature folder next to `tuner/`; may bring a router into `app/`)
- Play-along / songs feature
- Alternate tunings and manual string selection
- Adjustable reference pitch (A4)
- Other instruments
- React Compiler
- End-to-end tests

## 12. Risks

| Risk | Mitigation |
|---|---|
| Ding is crackly or quiet on iOS while the mic is open | Visual green state is the primary signal; test early on the iPhone |
| Low E detection is weak, especially on Android voice-processed input | Explicit test signals at 82 Hz in `core`; device checklist item 2 |
| Home Screen app re-asks for mic permission on each launch | Accepted; clear "Tap to start" flow |
| Cloudflare Worker Previews are in open beta | Production deploys do not depend on them; previews can be turned off |
| Husky has had no release since Nov 2024 | It works today; lefthook is a drop-in alternative |
| Tooling is new (Vite 8, Oxlint type-aware, pnpm, Vitest 5) | Pin exact versions; CI verifies the real combination on every PR |

# Attendance input investigation — 2026-11-18

## Report and limits

The tester uses PC Chrome and plays the supplied Em YouTube clip on a phone speaker. Attendance waits for a guitar chord, then times out. The cause on this physical setup is still unconfirmed. Synthetic browser audio cannot establish acoustic guitar or phone-speaker recognition accuracy.

## Reproduced defect

The mono AudioWorklet used discrete channel interpretation. A two-channel source containing Em only in its right channel reached the raw analyser but not the recognizer. The left-channel control succeeded. Speaker channel interpretation now downmixes both channels. The same actual Worklet/WASM regression recognizes both left-only and right-only synthetic Em; the right-only source also completes attendance through the application UI.

## Diagnostic changes

- Show a live microphone input meter independently of the recognizer.
- Expandable input diagnostics identify input check version 2 and the loaded application bundle, raw microphone RMS, decoder RMS, decoder status, unaccepted candidate, accepted-code stability, ringing level and gate.
- Keep diagnostics visible after the attendance timeout. Retry resets the attempt and reconnects the microphone/recognizer.
- Candidate labels are diagnostic only. They never satisfy attendance. No volume-only or automatic success fallback was introduced. Diagnostics do not record audio or enter participant exports.

## Next physical test

Hard-refresh the production app, confirm input check version 2, and repeat the phone-speaker Em clip in PC Chrome. Report whether the microphone meter moves, and the microphone RMS, decoder RMS, decoder status and candidate while the chord sounds. Zero raw input calls for device/input investigation; raw input without decoder input calls for pipeline investigation; decoder input without accepted chords calls for classifier/gate investigation. Do not lower thresholds without these observations.

## Verification

Targeted coverage includes stereo channel regression, attendance silence timeout and retry at 320px, actual synthetic Em attendance, keyboard/noise/speech negative attendance cases, Em/G/C lesson wrong-code rejection and matching repetitions, engine freshness/diagnostic-candidate rejection, asset integrity, export privacy and corresponding-source verification. Test output and deployment checks determine release readiness; the user’s acoustic test remains pending.

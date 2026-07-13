# Presence Tracker

This component is the first step toward a textbook-style target tracking layer
between raw LD2450 targets and final presence decisions.

Current status:

- Can be enabled as the primary presence/motion path through the advanced
  tracker-based detection setting.
- The legacy lambda path remains as the fallback path when tracker-based
  detection is disabled.
- Tracker output is exposed through `/api/state`, HA-facing entities, and
  diagnostic/replay logs when the tracker path is enabled.
- The 500ms ESPHome lambda only passes already-filtered target observations into
  the C++ component.
- Current `trackScore` is a diagnostic score, not a probability and not a
  product-facing reliability percentage.
- Track counters separate tracker input observations from retained tracks:
  `inputDetectionCount`, `activeTrackCount`, `tentativeTrackCount`,
  `confirmedTrackCount`, and `coastingTrackCount`.
- Each retained track exposes a transition `reason` and `stateChangedMs` for
  diagnostics. These are debug fields, not automation inputs.

Responsibilities:

- Associate raw target observations with short-lived tracks.
- Promote tracks through `tentative`, `confirmed`, and `coasting` states.
- Keep PIR as an instant presence-on hint.
- Produce tracker presence, motion, moving/still counts, track score,
  observation counters, and reason fields.

Non-goals for this step:

- Do not add sleep mode.
- Do not add BLE nearby logic.
- Do not add exit-zone evidence yet.
- Do not treat `trackScore` as a user-facing confidence percentage.

Known limitations:

- Association uses a small all-target assignment step. Because LD2450 exposes at
  most three targets, the tracker can brute-force the possible assignments
  instead of using a full Hungarian implementation.
- There is no prediction/covariance model yet.
- Confirmed/coasting tracks use a wider reassociation gate than tentative
  tracks, and new tentative tracks are suppressed when existing stable tracks
  already cover the current input count.
- Track position and velocity use a lightweight alpha-beta filter. Moving/still
  tracker output is based on smoothed velocity and smoothed displacement, not
  raw LD2450 speed alone.
- Coasting tracks can make `activeTrackCount` larger than `inputDetectionCount`.
- `trackScore` is derived from recent hits, misses, and track state. It should
  be treated as a debug score until real installation data validates it.
- `filter_blocked` is treated as a missed-observation frame, not a full tracker
  reset.
- Transition reasons distinguish new tentative tracks, M/N confirmation,
  PIR-assisted confirmation, reacquisition, coasting, and filter-blocked misses.

Future work lives in [presence-tracker-future.md](presence-tracker-future.md).

# Presence Replay Plan

This document defines the planned test workflow for presence reliability work.
The goal is to stop relying on long manual sitting tests and move toward
repeatable replay, scoring, and simulation.

This is a design document only. It does not change production behavior.

## 1. Goal

The device should be tested with repeatable input streams instead of requiring a
person to sit in front of the sensor for every tracker change.

The replay workflow should answer questions such as:

- Did presence turn off while the room was occupied?
- Did presence stay on while the room was empty?
- Did target identity or tracker state fragment during small motion?
- Did motion/still/direction states flap too often?
- Did a proposed tracker change improve one case while breaking another?

## 2. Test Layers

### 2.1 Firmware Smoke Test

This remains necessary, but it should be small.

Use it to confirm:

- The firmware boots.
- The API remains responsive.
- Diagnostics download works.
- Presence still works in obvious near-field cases.
- No crash or rollback loop appears.

This should not be the main way to tune tracker behavior.

### 2.2 Real Log Replay

The device should capture a compact raw replay log that can be downloaded and
replayed on a PC.

The replay log must include the input signals needed to reconstruct tracker
behavior, not only event summaries.

Planned endpoint:

```text
GET /api/diagnostics/replay.ndjson
```

The endpoint should return newline-delimited JSON. If the endpoint fails, it
must follow `docs/api-contract.md`.

Each row should represent one sampling tick. The preferred interval is the same
as the production presence tick.

Example compact row:

```json
{"q":12,"t":123456,"p":0,"lx":50.2,"r":[[1,1240,1810,2,2195,0,0,1],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],"tg":[[1,1240,1810,2,2195],[0,0,0,0,0],[0,0,0,0,0]],"f":[0,0,0,0,0],"ex":[0,0,0,-1],"l":[1,0,1,1,0,1,82,0,1,0,3,2,4],"tr":[1,0,2,1,100,1,1,0,1,0,0,1]}
```

Minimum fields:

- `q`: sample sequence.
- `t`: device uptime in milliseconds.
- `p`: PIR motion state.
- `lx`: illuminance if available.
- `r`: up to three LD2450 target slots before software/reduced/range filtering.
  Target tuple: `[valid, x, y, speed, distance, filterMode, filtered, rangeValid]`.
- `tg`: up to three target slots after the current production filter/range-gate path.
  Target tuple: `[valid, x, y, speed, distance]`.
- `f`: filter/range tuple:
  `[filterBlocked, rangeReasonCode, suspectCount, outOfRangeCount, remoteCandidateCount]`.
- `ex`: exit-zone evidence tuple:
  `[exitActive, exitZoneMask, exitTargetCount, exitLastSeenAgeMs]`.
- `l`: legacy production tuple:
  `[presence, motion, still, targetCount, movingCount, stillCount, stillConfidence, emptySamples,
  presenceReasonCode, presenceOffReasonCode, motionReasonCode, stillStateCode, stillReasonCode]`.
- `tr`: tracker tuple:
  `[presence, motion, stateCode, reasonCode, score, inputCount, activeCount, tentativeCount,
  confirmedCount, coastingCount, movingCount, stillCount]`.

The replay log should be RAM-only at first. It is diagnostic data, not user
configuration.

### 2.3 Ground Truth Labels

For real logs, ground truth should be written manually as short segments.

Example:

```json
{
  "segments": [
    {"from": "21:18:00", "to": "21:25:30", "occupied": true, "note": "sitting at desk"},
    {"from": "21:25:30", "to": "21:40:00", "occupied": false, "note": "room empty"}
  ]
}
```

The first version only needs occupancy truth. Exact target coordinates are not
required.

Optional future labels:

- `zone`: desk, bed, bathroom, entrance, etc.
- `activity`: sitting, eating, walking, sleeping, cleaning robot, empty.
- `sensor`: room, bathroom, or primary coordinator in multi-sensor tests.

## 3. Scoring

The replay tool should compare replay output against ground truth and produce
numbers.

Initial metrics:

- `false_off_count`: number of occupied segments where presence turned off.
- `false_off_seconds`: total time presence was off while occupied.
- `false_on_count`: number of empty segments where presence turned on.
- `false_on_seconds`: total time presence was on while empty.
- `presence_fragment_count`: number of on/off fragments during occupied time.
- `reacquire_latency_ms`: time from target reappearance or PIR hint to presence.
- `motion_flip_count`: number of motion on/off transitions.
- `still_flip_count`: number of still confirmed/lost transitions.
- `tracker_state_flip_count`: number of tracker lifecycle transitions.
- `target_drop_count`: number of ticks where all radar targets disappeared while
  truth was still occupied.

Later metrics can borrow ideas from multi-object tracking evaluation:

- Misses and false positives from CLEAR MOT.
- ID switches and fragmentation.
- Localization error if coordinate ground truth becomes available.

## 4. Replay Tool Shape

The first PC tool can be written in Python.

Planned location:

```text
tools/presence-replay/
```

Planned commands:

```text
python tools/presence-replay/replay.py logs/replay.ndjson --truth logs/truth.json
python tools/presence-replay/simulate.py scenarios/seated_10min.json --seed 1
python tools/presence-replay/montecarlo.py scenarios/seated_10min.json --runs 200
```

The first version should focus on scoring existing firmware outputs. It does
not need to perfectly reimplement the firmware tracker immediately.

Later versions can compare multiple tracker candidates:

- Legacy production logic.
- Current tracker-assisted logic.
- Alpha-beta tracker variant.
- Kalman filter variant.
- Noise-map variant.

## 5. Firmware Boundary

The firmware should only collect compact replay samples and expose downloads.

It should not run Monte Carlo simulation.

The 500 ms lambda should not grow. If replay logging is implemented, the lambda
should only pass the current sample to a dedicated diagnostics component.

## 6. Development Order

1. Define this document.
2. Add a compact raw replay sample structure.
3. Add a RAM ring buffer for replay samples.
4. Add `/api/diagnostics/replay.ndjson`.
5. Add a dashboard download button.
6. Add a PC replay scorer.
7. Add natural scenario simulation.
8. Add Monte Carlo runner.
9. Use replay results before changing production tracker behavior again.

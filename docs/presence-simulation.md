# Presence Simulation Plan

Natural motion and Monte Carlo simulation notes split out from [presence-replay.md](presence-replay.md).

## 1. Natural Simulation

Random tests must not be random point teleportation. The simulator should create
natural movement first, then apply sensor noise and dropouts.

### 1.1 Scenario Model

A scenario is a sequence of human-readable states.

Example:

```json
{
  "name": "desk_to_bathroom_and_back",
  "durationSeconds": 600,
  "room": {"widthMm": 3600, "depthMm": 5200},
  "segments": [
    {"state": "enter", "from": [0, 4800], "to": [1500, 2600], "durationSeconds": 8},
    {"state": "sit", "at": [1500, 2600], "durationSeconds": 240},
    {"state": "walk", "from": [1500, 2600], "to": [3000, 4600], "durationSeconds": 10},
    {"state": "away", "durationSeconds": 60},
    {"state": "walk", "from": [3000, 4600], "to": [1500, 2600], "durationSeconds": 10},
    {"state": "sit", "at": [1500, 2600], "durationSeconds": 240}
  ]
}
```

The simulator should generate a smooth truth trajectory from this scenario.

### 1.2 Natural Motion Rules

Use bounded movement rules:

- Walking uses continuous paths with speed and acceleration limits.
- Sitting uses small body sway and occasional hand/upper-body movement.
- Sleeping uses very small drift and long still periods.
- Eating uses repeated small movements around one location.
- Leaving the room removes the target after crossing an exit boundary.
- Returning starts from the entrance boundary, not from a random internal point.

Preferred simple models:

- Piecewise linear paths with eased acceleration/deceleration.
- Small correlated noise for body sway.
- Low-frequency random walk for seated/sleeping posture drift.
- Occasional short movement bursts for eating or desk work.

Avoid:

- Teleporting a target to unrelated coordinates.
- Independent random x/y points every frame.
- Random speed spikes unless testing a specific sensor glitch case.

### 1.3 Sensor Model

After truth motion is generated, the LD2450-like measurement model should create
observations.

Apply:

- Position noise based on range.
- Random short dropouts.
- Target slot swaps.
- Occasional duplicate target reports.
- Range-gate behavior around 6-8 m.
- Ghost target injection near reflective areas.
- PIR delay, PIR hold, or PIR miss.

These are measurement effects, not human movement effects.

### 1.4 Monte Carlo

Monte Carlo should run the same scenario many times with different random seeds.

Example:

```text
scenario: seated_10min
runs: 200
position_noise_mm: 100
dropout_probability: 0.03
max_dropout_frames: 6
ghost_probability: 0.01
```

The output should show average, percentile, and worst-case results.

Example:

```text
runs: 200
false_off_seconds_avg: 0.4
false_off_seconds_p95: 2.0
false_off_seconds_worst: 6.5
presence_fragment_count_avg: 0.2
motion_flip_count_avg: 4.8
```

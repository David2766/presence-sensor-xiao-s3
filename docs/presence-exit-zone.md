# Presence Exit Zone Design

This document defines the planned exit-zone evidence layer for improving
presence stability when LD2450 target observations temporarily disappear.

## 1. Goal

Exit zones should help decide whether a missing target means the person really
left the room or the radar temporarily lost a still/low-motion person.

The core rule is:

```text
target disappeared after crossing an exit area
=> allow presence to turn off quickly

target disappeared without exit evidence
=> treat it as a possible still-person dropout and hold presence longer
```

This is different from a simple fixed long delay. The system should not keep
presence on for a long time blindly. It should keep presence only when there is
no evidence that the person left.

## 2. Current Code Boundary

The current firmware/dashboard already has these zone concepts:

- `detection`: software zone presence.
- `filter`: block targets in known false-positive areas.
- `reduced`: calibration zone that delays filtering before accepting a target.
- `disabled` / excluded: ignore a zone in configuration/UI contexts.

None of these is an exit-evidence concept. A filter zone removes or weakens a
target. An exit zone should not remove a target. It should record that a track
passed through a likely exit path before disappearing.

## 3. Product Rule

Exit-zone logic must be single-sensor first.

Optional signals such as another room sensor, Home Assistant state, BLE nearby,
or multi-sensor coordination may improve confidence later, but the base product
must work from one device's own radar/PIR/tracker history.

## 4. Exit Evidence

A track may produce exit evidence when:

- Its smoothed track position enters an exit zone or exit boundary.
- Its recent movement direction points outward or toward the exit boundary.
- The target disappears shortly after the exit-area observation.

The first implementation should only record and expose this evidence for
diagnostics. It should not immediately change production presence behavior until
replay and real logs show that the evidence is reliable.

## 5. Non-Exit Dropout

When a confirmed track disappears away from an exit area:

- Treat it as a possible radar dropout.
- Keep tracker coasting active for a bounded time.
- Keep presence on longer than the normal short lost-target hold.
- Do not treat this as proof of sleep or BLE presence.

This path is intended for cases such as desk sitting, floor sleeping, or other
still/low-motion occupancy where LD2450 may temporarily lose the target.

## 6. First Data Model

The smallest practical UI/config change is to add an `exit` software zone type.

```ts
type WebZoneType = "detection" | "filter" | "disabled" | "exit";
```

This is intentionally simple. A later version may split exit evidence into a
separate object such as:

```ts
exitZones: []
exitEdges: []
```

Do not start with the separate model unless the UI or storage format clearly
needs it.

## 7. Suggested UI

The dashboard should eventually allow users to draw exit zones manually.

Recommended behavior:

- Add an `Exit` zone type in zone editing.
- Use a distinct color from detection/filter zones.
- Describe it as a door, hallway, room boundary, or area where people leave the
  monitored room.
- Keep it optional. The device should still work without an exit zone.

Future floorplan-assisted behavior:

- Suggest exit candidates from doors, room boundaries, narrow hallway-like
  geometry, or the 6m radar boundary when no wall is detected.
- Let the user confirm or edit suggested exit zones.

## 8. Firmware Shape

Avoid growing the 500ms lambda with complex exit logic.

Preferred direction:

- The lambda passes already-filtered target observations and zone-hit flags into
  the tracker layer.
- The tracker stores per-track exit evidence:
  - last exit observation time
  - last exit position
  - whether the track disappeared after exit evidence
  - whether a lost target had no exit evidence
- Presence decisions consume tracker output instead of duplicating exit logic in
  the lambda.

## 9. Replay Validation

Before enabling exit zones in production presence decisions, replay should
measure:

- Occupied false-off count without exit evidence.
- Empty false-on duration after exit evidence.
- Whether exit zones reduce long still-person dropouts.
- Whether exit zones create false absence when a person sits near a door.

Important test cases:

- Sitting still at a desk, target disappears, no exit evidence.
- Sleeping or lying still, target disappears, no exit evidence.
- Walking out through an exit zone, target disappears.
- Standing or sitting near an exit zone without leaving.
- False target or fan near an exit zone.

## 10. Implementation Order

1. Add this design document.
2. Add `exit` as a planned zone type in API/config documentation.
3. Add frontend drawing/display support.
4. Add diagnostics-only exit-zone hit logging.
5. Add replay scoring for exit evidence.
6. Only then connect exit evidence to production presence-off behavior.

## 11. Do Not

- Do not use exit zones as filter zones.
- Do not require exit-zone setup during first boot.
- Do not make multi-sensor logic mandatory for exit decisions.
- Do not replace tracker coasting with a blind long timeout.
- Do not change production presence behavior before replay data supports it.

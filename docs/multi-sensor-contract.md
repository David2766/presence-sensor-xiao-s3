# Multi-Sensor API Contract

Future multi-sensor and coordinator API notes split out from [api-contract.md](api-contract.md).

## 1. Future Multi-Sensor Contract

Future multi-sensor support should follow the same contract style. Sensors
should exchange structured observations, not user-facing text.

The preferred model is a local primary coordinator:

- Every sensor can operate independently.
- One sensor may be configured as `primary`.
- Other sensors may be configured as `secondary`.
- The primary reads peer observations and publishes the final room summary.
- Home Assistant, SmartThings, and the local dashboard should consume the
  primary summary for automation.
- Secondary sensors may still expose local state for diagnostics.

### 1.1 Observation Snapshot

Each sensor should be able to expose a compact observation snapshot.

Example:

```json
{
  "ok": true,
  "data": {
    "deviceId": "presence-sensor-desk",
    "roomId": "room_main",
    "role": "secondary",
    "observedAtMs": 12345678,
    "ttlMs": 3000,
    "sequence": 1024,
    "presence": {
      "detected": true,
      "confidence": 78,
      "sources": ["mmwave", "pir"]
    },
    "zones": [
      {
        "id": "zone_1",
        "presence": true,
        "confidence": 76
      }
    ]
  },
  "status": {
    "code": "observation_ready",
    "severity": "info",
    "detail": {}
  }
}
```

Required concepts for peer observations:

- `deviceId`: stable device identifier.
- `roomId`: logical room/group identifier.
- `role`: `standalone`, `primary`, or `secondary`.
- `observedAtMs`: local observation timestamp.
- `ttlMs`: how long this observation may be trusted.
- `sequence`: monotonic sequence number if available.
- `confidence`: 0-100 confidence score.
- `sources`: contributing sources such as `mmwave`, `pir`, `ble`, or `peer`.

### 1.2 Primary Summary

The primary coordinator should publish a final room-level summary.

Example:

```json
{
  "ok": true,
  "data": {
    "deviceId": "presence-sensor-main",
    "roomId": "room_main",
    "role": "primary",
    "roomPresence": true,
    "confidence": 84,
    "sources": ["self", "peer:presence-sensor-desk"],
    "peersOnline": 1,
    "peersTotal": 1,
    "updatedAtMs": 12345999
  },
  "status": {
    "code": "peer_sync_ok",
    "severity": "info",
    "detail": {
      "peerCount": 1
    }
  }
}
```

Rules:

- Platforms should use the primary summary for automation.
- Peer observations must expire when `ttlMs` is exceeded.
- The primary should not blindly trust stale peer data.
- The primary should keep local operation possible when peers are offline.
- Coordinates from different sensors should not be merged until sensor origins,
  rotations, and floorplan transforms are explicitly configured.

### 1.3 Platform Integration

Home Assistant and SmartThings may discover every sensor. That is acceptable.
However, automations should be guided toward the primary coordinator's summary
entities.

Recommended platform behavior:

- Primary exposes room-level presence, motion, confidence, peer count, and
  coordinator health.
- Secondary exposes local presence, local targets, and diagnostic state.
- Platform integrations should not be responsible for confidence merging,
  peer TTL handling, or conflict resolution.
- Local device APIs should remain the source of truth for multi-sensor
  coordination.

### 1.4 Multi-Sensor Code Examples

Future registry candidates:

| Code | Severity | HTTP | Meaning | Detail |
|---|---|---:|---|---|
| `observation_ready` | info | 200 | Local observation snapshot is available. | `deviceId`, `sequence` |
| `peer_sync_ok` | info | 200 | Primary successfully merged peer observations. | `peerCount` |
| `peer_unreachable` | warning | 200 | A configured peer did not respond. | `peerId`, `lastSeenMs` |
| `peer_observation_expired` | warning | 200 | Peer data expired and was ignored. | `peerId`, `ttlMs` |
| `coordinator_role_changed` | info | 200 | Device role changed. | `role` |

---

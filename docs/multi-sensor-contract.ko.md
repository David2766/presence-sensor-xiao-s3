# 다중 센서 API 계약

[api-contract.ko.md](api-contract.ko.md)에서 분리한 향후 다중 센서 및 coordinator API 메모다.

## 1. 향후 다중 센서 계약

향후 다중 센서 지원도 같은 API 기조를 따른다. 센서끼리는 사용자 표시 문장이 아니라
구조화된 observation을 주고받아야 한다.

권장 모델은 로컬 primary coordinator 구조다.

- 각 센서는 독립적으로 동작할 수 있다.
- 한 센서를 `primary`로 설정할 수 있다.
- 다른 센서는 `secondary`로 설정할 수 있다.
- primary는 peer observation을 읽고 최종 room summary를 제공한다.
- Home Assistant, SmartThings, 로컬 대시보드는 자동화에 primary summary를 사용한다.
- secondary 센서도 진단용 local state는 계속 노출할 수 있다.

### 1.1 Observation Snapshot

각 센서는 짧은 observation snapshot을 제공할 수 있어야 한다.

예시:

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

Peer observation에 필요한 개념:

- `deviceId`: 안정적인 기기 식별자.
- `roomId`: 논리적인 방 또는 그룹 식별자.
- `role`: `standalone`, `primary`, `secondary` 중 하나.
- `observedAtMs`: local observation timestamp.
- `ttlMs`: 이 observation을 신뢰할 수 있는 시간.
- `sequence`: 가능하면 단조 증가하는 sequence 번호.
- `confidence`: 0-100 confidence 점수.
- `sources`: `mmwave`, `pir`, `ble`, `peer` 같은 기여 source.

### 1.2 Primary Summary

Primary coordinator는 최종 room-level summary를 제공해야 한다.

예시:

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

규칙:

- 플랫폼 자동화는 primary summary를 사용하도록 안내한다.
- `ttlMs`가 지난 peer observation은 만료 처리한다.
- primary는 오래된 peer 데이터를 무조건 신뢰하면 안 된다.
- peer가 offline이어도 primary의 local 동작은 가능해야 한다.
- 여러 센서의 좌표는 센서 origin, rotation, floorplan transform이 명시적으로 설정되기 전까지
  합치지 않는다.

### 1.3 플랫폼 연동

Home Assistant와 SmartThings에는 모든 센서가 발견될 수 있다. 이는 허용한다. 다만 자동화는
primary coordinator의 summary entity를 사용하도록 안내한다.

권장 플랫폼 동작:

- primary는 room-level presence, motion, confidence, peer count, coordinator health를 제공한다.
- secondary는 local presence, local targets, diagnostic state를 제공한다.
- 플랫폼 integration은 confidence 병합, peer TTL 처리, 충돌 해결을 담당하지 않는다.
- 다중 센서 coordination의 source of truth는 로컬 기기 API가 된다.

### 1.4 다중 센서 코드 예시

향후 registry 후보:

| Code | Severity | HTTP | 의미 | Detail |
|---|---|---:|---|---|
| `observation_ready` | info | 200 | Local observation snapshot 사용 가능 | `deviceId`, `sequence` |
| `peer_sync_ok` | info | 200 | Primary가 peer observation 병합 성공 | `peerCount` |
| `peer_unreachable` | warning | 200 | 설정된 peer가 응답하지 않음 | `peerId`, `lastSeenMs` |
| `peer_observation_expired` | warning | 200 | Peer data가 만료되어 무시됨 | `peerId`, `ttlMs` |
| `coordinator_role_changed` | info | 200 | 기기 역할이 변경됨 | `role` |

---

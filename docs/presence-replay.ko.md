# 재실 리플레이 계획

이 문서는 재실 감지 신뢰성 개선을 위한 테스트 흐름을 정의한다.
목표는 사람이 센서 앞에 오래 앉아 있는 방식에서 벗어나, 같은 입력을 반복
재생하고 점수화할 수 있게 만드는 것이다.

이 문서는 설계 문서이며 production 동작을 변경하지 않는다.

## 1. 목표

tracker를 수정할 때마다 사람이 직접 10분씩 앉아 있는 방식은 반복성이 낮고
시간이 너무 많이 든다.

리플레이 테스트는 다음 질문에 답할 수 있어야 한다.

- 사람이 있는데 재실이 꺼졌는가?
- 사람이 없는데 재실이 켜졌는가?
- 작은 움직임 중 target identity 또는 tracker state가 쪼개졌는가?
- motion/still/direction 상태가 너무 자주 튀는가?
- 새 tracker 변경이 한 케이스를 개선하면서 다른 케이스를 망가뜨렸는가?

## 2. 테스트 계층

### 2.1 펌웨어 Smoke Test

실기기 테스트는 여전히 필요하지만 작게 유지한다.

확인 대상:

- 펌웨어가 부팅되는지
- API가 응답하는지
- 진단 로그 다운로드가 되는지
- 근거리 명확한 상황에서 재실 감지가 되는지
- 크래시나 rollback loop가 없는지

이 방식은 tracker 튜닝의 주 테스트 수단이 아니다.

### 2.2 실제 로그 리플레이

기기에서 PC로 내려받아 재생할 수 있는 compact raw replay log가 필요하다.

리플레이 로그는 이벤트 요약만이 아니라 tracker 동작을 다시 구성할 수 있는
입력 신호를 포함해야 한다.

계획 endpoint:

```text
GET /api/diagnostics/replay.ndjson
```

endpoint는 newline-delimited JSON을 반환한다. 실패 응답은
`docs/api-contract.md`를 따른다.

각 줄은 sampling tick 하나를 나타낸다. 가능하면 production presence tick과
같은 주기를 사용한다.

Compact row 예시:

```json
{"q":12,"t":123456,"p":0,"lx":50.2,"r":[[1,1240,1810,2,2195,0,0,1],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],"tg":[[1,1240,1810,2,2195],[0,0,0,0,0],[0,0,0,0,0]],"f":[0,0,0,0,0],"ex":[0,0,0,-1],"l":[1,0,1,1,0,1,82,0,1,0,3,2,4],"tr":[1,0,2,1,100,1,1,0,1,0,0,1]}
```

최소 필드:

- `q`: sample sequence
- `t`: 장치 uptime milliseconds
- `p`: PIR motion 상태
- `lx`: 가능하면 조도
- `r`: software/reduced/range filtering 전 LD2450 target slot 최대 3개
  Target tuple: `[valid, x, y, speed, distance, filterMode, filtered, rangeValid]`
- `tg`: 현재 production filter/range-gate 경로를 지난 target slot 최대 3개
  Target tuple: `[valid, x, y, speed, distance]`
- `f`: filter/range tuple:
  `[filterBlocked, rangeReasonCode, suspectCount, outOfRangeCount, remoteCandidateCount]`
- `ex`: exit zone evidence tuple:
  `[exitActive, exitZoneMask, exitTargetCount, exitLastSeenAgeMs]`
- `l`: legacy production tuple:
  `[presence, motion, still, targetCount, movingCount, stillCount, stillConfidence, emptySamples,
  presenceReasonCode, presenceOffReasonCode, motionReasonCode, stillStateCode, stillReasonCode]`
- `tr`: tracker tuple:
  `[presence, motion, stateCode, reasonCode, score, inputCount, activeCount, tentativeCount,
  confirmedCount, coastingCount, movingCount, stillCount]`

리플레이 로그는 우선 RAM 전용으로 둔다. 사용자 설정이 아니라 진단 데이터다.

### 2.3 Ground Truth 라벨

실제 로그에는 사람이 짧게 정답 구간을 적는다.

예시:

```json
{
  "segments": [
    {"from": "21:18:00", "to": "21:25:30", "occupied": true, "note": "책상에 앉아있음"},
    {"from": "21:25:30", "to": "21:40:00", "occupied": false, "note": "빈 방"}
  ]
}
```

첫 버전은 occupancy truth만 있으면 된다. 정확한 좌표 정답까지는 필요 없다.

나중에 추가할 수 있는 라벨:

- `zone`: desk, bed, bathroom, entrance 등
- `activity`: sitting, eating, walking, sleeping, cleaning robot, empty
- `sensor`: room, bathroom, 또는 multi-sensor primary coordinator

## 3. 점수화

리플레이 도구는 replay output을 ground truth와 비교해서 숫자로 보여줘야 한다.

초기 지표:

- `false_off_count`: 사람이 있는데 재실이 꺼진 횟수
- `false_off_seconds`: 사람이 있는데 재실이 꺼진 총 시간
- `false_on_count`: 빈 방인데 재실이 켜진 횟수
- `false_on_seconds`: 빈 방인데 재실이 켜진 총 시간
- `presence_fragment_count`: occupied 상태에서 on/off가 쪼개진 횟수
- `reacquire_latency_ms`: target 재등장 또는 PIR hint 후 재실 회복 시간
- `motion_flip_count`: motion on/off 전환 횟수
- `still_flip_count`: still confirmed/lost 전환 횟수
- `tracker_state_flip_count`: tracker lifecycle 전환 횟수
- `target_drop_count`: truth는 occupied인데 radar target이 모두 사라진 tick 수

나중에는 multi-object tracking 평가에서 쓰는 개념을 일부 가져올 수 있다.

- miss와 false positive
- ID switch와 fragmentation
- 좌표 ground truth가 생기면 localization error

## 4. 리플레이 도구 형태

첫 PC 도구는 Python으로 시작해도 된다.

계획 위치:

```text
tools/presence-replay/
```

계획 명령:

```text
python tools/presence-replay/replay.py logs/replay.ndjson --truth logs/truth.json
python tools/presence-replay/simulate.py scenarios/seated_10min.json --seed 1
python tools/presence-replay/montecarlo.py scenarios/seated_10min.json --runs 200
```

첫 버전은 기존 펌웨어 출력 점수화에 집중한다. 펌웨어 tracker를 완전히 다시
구현할 필요는 없다.

나중에는 여러 tracker 후보를 비교할 수 있다.

- 기존 production logic
- 현재 tracker-assisted logic
- alpha-beta tracker variant
- Kalman filter variant
- noise-map variant

## 5. 펌웨어 경계

펌웨어는 compact replay sample을 모으고 다운로드하게 해주는 역할만 한다.

Monte Carlo 시뮬레이션은 펌웨어 안에서 돌리지 않는다.

500 ms lambda는 커지면 안 된다. replay logging을 구현하더라도 lambda는 현재
sample을 전용 diagnostics component로 넘기는 정도만 한다.

## 6. 개발 순서

1. 이 문서를 정의한다.
2. compact raw replay sample 구조를 추가한다.
3. replay sample용 RAM ring buffer를 추가한다.
4. `/api/diagnostics/replay.ndjson` endpoint를 추가한다.
5. 대시보드 다운로드 버튼을 추가한다.
6. PC replay scorer를 추가한다.
7. 자연스러운 시나리오 시뮬레이션을 추가한다.
8. Monte Carlo runner를 추가한다.
9. production tracker behavior를 다시 바꾸기 전에 replay 결과를 먼저 본다.

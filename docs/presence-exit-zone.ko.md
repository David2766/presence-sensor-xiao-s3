# 재실 Exit Zone 설계

이 문서는 LD2450 target 관측값이 잠깐 사라질 때 재실 안정성을 높이기 위한
exit zone evidence layer를 정의한다.

## 1. 목표

exit zone은 target이 사라졌을 때 사람이 실제로 방을 나간 것인지, 아니면
레이더가 정지/저움직임 사람을 잠깐 놓친 것인지 판단하는 데 도움을 주기 위한
개념이다.

핵심 규칙은 이렇다.

```text
target이 exit 영역을 지난 뒤 사라짐
=> 재실 OFF를 빠르게 허용

target이 exit evidence 없이 사라짐
=> 정지 인체 dropout 가능성으로 보고 재실을 더 유지
```

이건 단순히 긴 delay를 거는 방식과 다르다. 시스템은 무작정 오래 재실을 켜두는
것이 아니라, 사람이 나갔다는 증거가 없을 때만 재실을 유지해야 한다.

## 2. 현재 코드 경계

현재 펌웨어/대시보드에는 이미 다음 구역 개념이 있다.

- `detection`: software zone 재실.
- `filter`: 알려진 오탐 영역의 target 차단.
- `reduced`: target을 바로 막지 않고 일정 시간 지연 후 통과시키는 보정 구역.
- `disabled` / excluded: 설정/UI 맥락에서 제외하는 구역.

이 중 어느 것도 exit evidence 개념은 아니다. filter zone은 target을 제거하거나
약화한다. exit zone은 target을 제거하면 안 된다. exit zone은 track이 사라지기
전에 나갈 가능성이 높은 경로를 지났다는 증거를 기록해야 한다.

## 3. 제품 규칙

exit-zone 로직은 단일 센서 우선이어야 한다.

다른 방 센서, Home Assistant 상태, BLE nearby, 다중 센서 coordinator 같은 선택
신호는 나중에 신뢰도를 높이는 데 사용할 수 있다. 하지만 기본 제품 로직은 한
기기 자체의 radar/PIR/tracker history만으로 동작해야 한다.

## 4. Exit Evidence

track은 다음 조건에서 exit evidence를 만들 수 있다.

- smoothed track 위치가 exit zone 또는 exit boundary에 들어감.
- 최근 이동 방향이 바깥쪽 또는 exit boundary 쪽을 향함.
- exit 영역 관측 직후 target이 사라짐.

첫 구현은 이 evidence를 진단용으로 기록하고 노출하는 것부터 시작해야 한다.
replay와 실제 로그에서 신뢰성이 확인되기 전에는 production 재실 동작을 바로
바꾸지 않는다.

## 5. Non-Exit Dropout

confirmed track이 exit 영역이 아닌 곳에서 사라지면:

- radar dropout 가능성으로 본다.
- tracker coasting을 제한된 시간 동안 유지한다.
- 일반적인 짧은 target lost hold보다 재실을 더 오래 유지한다.
- 이것을 수면 또는 BLE 재실 증거로 취급하지 않는다.

이 경로는 책상에 앉아 있거나, 바닥에서 자거나, 다른 정지/저움직임 재실 상황에서
LD2450이 target을 잠깐 놓치는 문제를 줄이기 위한 것이다.

## 6. 첫 데이터 모델

가장 작은 UI/config 변경은 software zone type에 `exit`을 추가하는 것이다.

```ts
type WebZoneType = "detection" | "filter" | "disabled" | "exit";
```

이건 의도적으로 단순한 시작점이다. 나중에는 다음처럼 별도 구조로 분리할 수 있다.

```ts
exitZones: []
exitEdges: []
```

하지만 UI나 저장 포맷에서 명확한 필요가 생기기 전에는 별도 모델부터 시작하지
않는다.

## 7. 권장 UI

대시보드는 최종적으로 사용자가 exit zone을 직접 그릴 수 있어야 한다.

권장 동작:

- 구역 편집에 `Exit` 타입을 추가한다.
- detection/filter zone과 구분되는 색상을 사용한다.
- 문, 복도, 방 경계, 사람이 감지 공간을 나가는 위치라고 설명한다.
- 선택 기능으로 둔다. exit zone이 없어도 기기는 동작해야 한다.

향후 평면도 보조 동작:

- 문, 방 경계, 좁은 복도형 구조, 벽이 없는 6m radar boundary에서 exit 후보를
  제안한다.
- 사용자가 제안된 exit zone을 확인하거나 수정하게 한다.

## 8. 펌웨어 형태

복잡한 exit logic을 500ms lambda에 계속 키워 넣지 않는다.

권장 방향:

- lambda는 이미 필터링된 target 관측값과 zone-hit flag를 tracker layer로 넘긴다.
- tracker는 track별 exit evidence를 저장한다.
  - 마지막 exit 관측 시각
  - 마지막 exit 위치
  - exit evidence 이후 track이 사라졌는지
  - exit evidence 없이 target lost가 발생했는지
- 재실 판단은 lambda 안에서 exit logic을 중복 구현하지 말고 tracker 출력을 소비한다.

## 9. Replay 검증

exit zone을 production 재실 판단에 연결하기 전에 replay에서 다음을 측정해야 한다.

- exit evidence 없이 발생한 occupied false-off 횟수.
- exit evidence 이후에도 남는 empty false-on 시간.
- exit zone이 긴 정지 인체 dropout을 줄이는지.
- 문 근처에 앉아 있는 사람을 false absence로 만들지 않는지.

중요 테스트 케이스:

- 책상에 앉아 정지, target 사라짐, exit evidence 없음.
- 수면 또는 누운 정지 상태, target 사라짐, exit evidence 없음.
- exit zone을 지나 방 밖으로 나간 뒤 target 사라짐.
- exit zone 근처에 서 있거나 앉아 있지만 나가지 않음.
- exit zone 근처의 false target 또는 팬.

## 10. 구현 순서

1. 이 설계 문서를 추가한다.
2. API/config 문서에 `exit` planned zone type을 추가한다.
3. 프론트엔드에서 그리기/표시를 지원한다.
4. 진단 전용 exit-zone hit logging을 추가한다.
5. replay scoring에 exit evidence 항목을 추가한다.
6. 그다음에만 exit evidence를 production presence-off 동작에 연결한다.

## 11. 금지 사항

- exit zone을 filter zone처럼 사용하지 않는다.
- 첫 부팅에서 exit-zone 설정을 필수로 만들지 않는다.
- exit 판단에 다중 센서 로직을 필수로 요구하지 않는다.
- tracker coasting을 무식한 긴 timeout으로 대체하지 않는다.
- replay 데이터로 근거가 생기기 전에 production 재실 동작을 바꾸지 않는다.

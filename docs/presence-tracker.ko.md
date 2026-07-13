# 재실 트래커

이 컴포넌트는 LD2450 raw target과 최종 재실 판정 사이에 들어가는 추적 레이어의
첫 단계다.

현재 상태:

- 고급 설정의 tracker 기반 감지를 켜면 재실/움직임의 primary 경로로 사용할 수 있다.
- tracker 기반 감지가 꺼져 있으면 기존 lambda 경로가 fallback으로 남는다.
- tracker 경로가 켜져 있으면 출력은 `/api/state`, HA 엔티티, 진단/replay 로그에 반영된다.
- 500ms ESPHome 람다는 이미 필터링된 target 관측값만 C++ 컴포넌트로 넘긴다.

책임:

- raw target 관측값을 짧은 생명주기의 track과 연결한다.
- track을 `tentative`, `confirmed`, `coasting` 상태로 승격/유지한다.
- PIR은 즉시 재실 ON 힌트로 유지한다.
- tracker presence, motion, 움직임/정지 count, track score, 관측 counter, reason 값을 만든다.

이번 단계에서 하지 않는 것:

- 수면 모드를 추가하지 않는다.
- BLE nearby 로직을 추가하지 않는다.
- exit-zone evidence를 아직 추가하지 않는다.
- `trackScore`를 사용자-facing 신뢰도 퍼센트로 취급하지 않는다.

향후 작업은 [presence-tracker-future.ko.md](presence-tracker-future.ko.md)에 둔다.

# 재실 트래커 향후 작업

[presence-tracker.ko.md](presence-tracker.ko.md)에서 분리한 향후 tracker 작업 메모다.

## 1. 다음 안전한 단계

1. 실제 진단 로그에서 기존 presence와 tracker presence를 비교한다.
2. shadow 데이터가 안정적이면 direction/moving/still 표시 로직부터 tracker 출력으로 옮긴다.
3. 실제 설치 데이터로 tracker 경로가 안정적이라는 것이 확인될 때까지 기존 경로를 fallback으로 유지한다.

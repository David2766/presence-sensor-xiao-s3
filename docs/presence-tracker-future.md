# Presence Tracker Future Work

Future tracker work split out from [presence-tracker.md](presence-tracker.md).

## 1. Next Safe Steps

1. Compare legacy presence with tracker presence in real diagnostic logs.
2. Compare `inputDetectionCount`, `activeTrackCount`, `confirmedTrackCount`,
   and `coastingTrackCount` against real logs. `activeTrackCount` should no
   longer grow repeatedly while `inputDetectionCount` stays at 1.
3. Tune the tentative/confirmed/coasting lifecycle using `observedFrames`,
   `missedFrames`, `recentHits`, `trackState`, and transition `reason`.
4. Compare smoothed tracker moving/still output against the legacy raw
   moving/still counters before using tracker output anywhere else.
5. Keep the legacy path available as a fallback until real installation data
   proves the tracker path is stable enough to become the default.

---

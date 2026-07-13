<script lang="ts">
  import type { WebDeviceState } from "../types";

  type Props = {
    open: boolean;
    state: WebDeviceState | null;
    onClose: () => void;
  };

  let { open, state, onClose }: Props = $props();

  const debug = $derived(state?.debug);
  const still = $derived(debug?.still);
  const range = $derived(debug?.range);
  const tracker = $derived(debug?.tracker);

  function closeFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) onClose();
  }

  function formatMs(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "-";
    if (value < 1000) return `${Math.round(value)}ms`;
    if (value < 60000) return `${(value / 1000).toFixed(1)}초`;
    return `${Math.round(value / 60000)}분`;
  }

  function formatAge(value: number | null | undefined): string {
    const formatted = formatMs(value);
    return formatted === "-" ? "-" : `${formatted} 전`;
  }

  function formatCount(value: number | null | undefined, suffix = ""): string {
    return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : "-";
  }

  function formatBool(value: boolean | undefined): string {
    if (value === undefined) return "-";
    return value ? "활성" : "비활성";
  }

  function formatAnchor(anchor: { x?: number; y?: number } | null | undefined): string {
    if (!anchor || !Number.isFinite(anchor.x ?? NaN) || !Number.isFinite(anchor.y ?? NaN)) return "-";
    return `${Math.round(Number(anchor.x))}, ${Math.round(Number(anchor.y))} mm`;
  }
</script>

{#if open}
  <div class="dashboard-dialog-backdrop" role="presentation" onclick={closeFromBackdrop}>
    <div
      class="floorplan-delete-dialog dashboard-control-dialog diagnostic-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostic-dialog-title"
    >
      <div class="dashboard-dialog-heading">
        <strong id="diagnostic-dialog-title">진단 정보</strong>
        <span>재실 판정, 정지 타깃 안정화, 거리 필터 상태를 확인합니다.</span>
      </div>

      {#if !debug}
        <div class="diagnostic-empty">아직 진단 데이터가 없습니다.</div>
      {:else}
        <div class="diagnostic-summary-grid">
          <article>
            <span>재실 판정</span>
            <strong>{debug.presenceReason ?? "-"}</strong>
          </article>
          <article>
            <span>정지 안정화</span>
            <strong>{still?.state ?? "-"}</strong>
          </article>
          <article>
            <span>거리 필터</span>
            <strong>{range?.reason ?? "-"}</strong>
          </article>
        </div>

        <div class="diagnostic-section">
          <strong>재실 판정</strong>
          <dl class="diagnostic-list">
            <div>
              <dt>현재 사유</dt>
              <dd>{debug.presenceReason ?? "-"}</dd>
            </div>
            <div>
              <dt>해제 사유</dt>
              <dd>{debug.presenceOffReason ?? "-"}</dd>
            </div>
            <div>
              <dt>움직임 사유</dt>
              <dd>{debug.motionReason ?? "-"}</dd>
            </div>
            <div>
              <dt>마지막 타깃</dt>
              <dd>{formatAge(debug.lastValidTargetAgeMs)}</dd>
            </div>
          </dl>
        </div>

        <div class="diagnostic-section">
          <strong>정지 타깃 안정화</strong>
          <dl class="diagnostic-list">
            <div>
              <dt>상태</dt>
              <dd>{still?.state ?? "-"}</dd>
            </div>
            <div>
              <dt>사유</dt>
              <dd>{still?.reason ?? "-"}</dd>
            </div>
            <div>
              <dt>신뢰도</dt>
              <dd>{formatCount(still?.confidence, "%")}</dd>
            </div>
            <div>
              <dt>홀드</dt>
              <dd>{formatBool(still?.holdActive)}</dd>
            </div>
            <div>
              <dt>마지막 정지 타깃</dt>
              <dd>{formatAge(still?.lastSeenAgeMs)}</dd>
            </div>
            <div>
              <dt>기준 좌표</dt>
              <dd>{formatAnchor(still?.anchor)}</dd>
            </div>
          </dl>
        </div>

        <div class="diagnostic-section">
          <strong>거리 / 고스트 필터</strong>
          <dl class="diagnostic-list">
            <div>
              <dt>상태</dt>
              <dd>{range?.reason ?? "-"}</dd>
            </div>
            <div>
              <dt>고스트 후보</dt>
              <dd>{formatCount(range?.suspectTargetCount, "개")}</dd>
            </div>
            <div>
              <dt>8m 초과</dt>
              <dd>{formatCount(range?.outOfRangeTargetCount, "개")}</dd>
            </div>
            <div>
              <dt>PIR 검증</dt>
              <dd>{formatCount(range?.remoteCandidateCount, "개")}</dd>
            </div>
          </dl>
        </div>

        <div class="diagnostic-section">
          <strong>Tracker Shadow</strong>
          <dl class="diagnostic-list">
            <div>
              <dt>추천 재실</dt>
              <dd>{formatBool(tracker?.presence)}</dd>
            </div>
            <div>
              <dt>추천 움직임</dt>
              <dd>{formatBool(tracker?.motion)}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{tracker?.state ?? "-"}</dd>
            </div>
            <div>
              <dt>사유</dt>
              <dd>{tracker?.reason ?? "-"}</dd>
            </div>
            <div>
              <dt>신뢰도</dt>
              <dd>{formatCount(tracker?.trackScore)}</dd>
            </div>
            <div>
              <dt>Input / Active / Tentative / Confirmed / Coasting</dt>
              <dd>
                {formatCount(tracker?.inputDetectionCount)} /
                {formatCount(tracker?.activeTrackCount)} /
                {formatCount(tracker?.tentativeTrackCount)} /
                {formatCount(tracker?.confirmedTrackCount)} /
                {formatCount(tracker?.coastingTrackCount)}
              </dd>
            </div>
            <div>
              <dt>Moving / Still</dt>
              <dd>
                {formatCount(tracker?.movingTrackCount)} /
                {formatCount(tracker?.stillTrackCount)}
              </dd>
            </div>
          </dl>
        </div>

        <div class="diagnostic-section">
          <strong>최근 끊김</strong>
          <dl class="diagnostic-list">
            <div>
              <dt>최근 해제</dt>
              <dd>{formatMs(debug.lastPresenceDropMs)}</dd>
            </div>
            <div>
              <dt>빈 샘플</dt>
              <dd>{formatCount(debug.emptySamplesConsecutive)}</dd>
            </div>
            <div>
              <dt>짧은 끊김</dt>
              <dd>{formatCount(debug.shortPresenceDropCount, "회")}</dd>
            </div>
            <div>
              <dt>긴 끊김</dt>
              <dd>{formatCount(debug.longPresenceDropCount, "회")}</dd>
            </div>
          </dl>
        </div>
      {/if}

      <div class="floorplan-delete-dialog-actions">
        <a class="diagnostic-log-download-button" href="/api/diagnostics/events.txt" download="presence-diagnostics.txt">
          이벤트 로그 다운로드
        </a>
        <a class="diagnostic-log-download-button" href="/api/diagnostics/replay.ndjson" download="presence-replay.ndjson">
          리플레이 로그 다운로드
        </a>
        <button type="button" class="dashboard-dialog-close-button" onclick={onClose}>닫기</button>
      </div>
    </div>
  </div>
{/if}

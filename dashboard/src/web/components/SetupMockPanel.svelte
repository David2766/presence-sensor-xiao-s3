<script lang="ts">
  type MockNetwork = {
    ssid: string;
    rssi: number;
    locked: boolean;
  };

  const networks: MockNetwork[] = [
    { ssid: "RoundNational", rssi: -31, locked: true },
    { ssid: "LivingRoom_5G", rssi: -44, locked: true },
    { ssid: "Kitchen-IoT", rssi: -58, locked: true },
    { ssid: "Galaxy Hotspot", rssi: -63, locked: true },
    { ssid: "HomeMesh_Extender", rssi: -68, locked: true },
    { ssid: "Neighbor_WiFi_2.4G", rssi: -73, locked: true },
    { ssid: "Office Guest", rssi: -77, locked: false },
    { ssid: "Very-Long-WiFi-Name-For-Mobile-Layout-Check", rssi: -82, locked: true }
  ].sort((a, b) => b.rssi - a.rssi);

  let selected = "";
  let password = "";
  let expanded = false;
  let connecting = false;
  let message = "";
  let messageTone: "" | "ok" | "error" = "";

  const visibleNetworks = () => (expanded ? networks : networks.slice(0, 5));

  function bars(rssi: number): string {
    if (rssi >= -55) return "강함";
    if (rssi >= -70) return "보통";
    return "약함";
  }

  function selectNetwork(ssid: string): void {
    selected = ssid;
    message = "";
    messageTone = "";
  }

  function refreshNetworks(): void {
    message = "주변 Wi-Fi를 다시 검색합니다.";
    messageTone = "";
    setTimeout(() => {
      message = "레이아웃 확인용 mock 목록입니다.";
    }, 700);
  }

  function connect(): void {
    if (!selected || connecting) return;
    connecting = true;
    message = "Wi-Fi 정보를 저장하고 연결을 시도합니다.";
    messageTone = "";
    setTimeout(() => {
      message = "설정이 완료되었습니다. mock 대시보드로 이동합니다.";
      messageTone = "ok";
    }, 900);
    setTimeout(() => {
      window.location.href = "/dashboard/?mock=1";
    }, 1800);
  }
</script>

<main class="setup-shell">
  <section class="setup-card">
    <p class="eyebrow">초기 Wi-Fi 설정</p>
    <h1 class="title">Presence Sensor Mock</h1>
    <p class="desc">연결할 Wi-Fi를 선택하고 비밀번호를 입력하세요. 설정이 완료되면 기기가 새 네트워크로 이동합니다.</p>
    <div class="notice">이 화면은 localhost 레이아웃 확인용입니다. 실제 Wi-Fi 저장이나 ESP32 연결은 수행하지 않습니다.</div>
    <div class="status">
      <span>상태</span><b>설정 대기</b>
      <span>설정 주소</span><b>192.168.4.1</b>
    </div>

    <div class="field-label">Wi-Fi 목록</div>
    <div class="networks">
      {#each visibleNetworks() as network}
        <button
          class:selected={network.ssid === selected}
          class="net"
          type="button"
          onclick={() => selectNetwork(network.ssid)}
        >
          <span>{network.ssid}</span>
          <small>{network.locked ? "잠금 · " : ""}{bars(network.rssi)} · {network.rssi}dBm</small>
        </button>
      {/each}
    </div>
    {#if networks.length > 5}
      <button class="net-more" type="button" onclick={() => (expanded = !expanded)}>
        {expanded ? "접기" : `더 보기 ${networks.length - 5}개`}
      </button>
    {/if}

    <label for="setup-mock-password">비밀번호</label>
    <input
      id="setup-mock-password"
      type="password"
      bind:value={password}
      autocomplete="current-password"
      placeholder="Wi-Fi 비밀번호"
    />

    <div class="actions">
      <button class="btn secondary" type="button" onclick={refreshNetworks}>새로고침</button>
      <button class="btn" type="button" disabled={!selected || connecting} onclick={connect}>
        {connecting ? "연결 중" : "연결하기"}
      </button>
    </div>
    <div class:error={messageTone === "error"} class:ok={messageTone === "ok"} class="message">{message}</div>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0b1117;
  }

  .setup-shell {
    box-sizing: border-box;
    min-height: 100vh;
    min-height: 100dvh;
    background: linear-gradient(180deg, #0b1117, #0e161e);
    color: #e8f0f6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(14px, 4vw, 28px);
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  .setup-card {
    width: min(520px, 100%);
    box-sizing: border-box;
    background: #101923;
    border: 1px solid #263849;
    border-radius: 18px;
    padding: 22px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
  }

  .eyebrow {
    font-size: 13px;
    color: #19b394;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .title {
    font-size: 25px;
    line-height: 1.2;
    font-weight: 800;
    margin: 0 0 8px;
  }

  .desc {
    font-size: 14px;
    line-height: 1.55;
    color: #91a4b5;
    margin: 0 0 18px;
  }

  .notice {
    margin: 0 0 16px;
    padding: 12px 13px;
    border: 1px solid rgba(25, 179, 148, 0.28);
    border-radius: 12px;
    background: rgba(25, 179, 148, 0.08);
    color: #b8f1e4;
    font-size: 13px;
    line-height: 1.45;
  }

  .status {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px 14px;
    margin: 0 0 18px;
    padding: 14px;
    border: 1px solid #263849;
    border-radius: 12px;
    background: #0d151d;
  }

  .status span,
  label,
  .field-label {
    font-size: 13px;
    color: #91a4b5;
  }

  .status b {
    font-size: 13px;
    text-align: right;
  }

  label,
  .field-label {
    display: block;
    margin: 14px 0 7px;
  }

  .networks {
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    margin: 8px 0 8px;
    max-height: 36dvh;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
  }

  .net {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 50px;
    border: 1px solid #263849;
    border-radius: 12px;
    background: #152330;
    color: #e8f0f6;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px;
    text-align: left;
    font: inherit;
  }

  .net span {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .net small {
    color: #91a4b5;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .net.selected {
    border-color: #19b394;
    box-shadow: 0 0 0 1px #19b394;
  }

  .net-more {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    height: 42px;
    margin: 0 0 12px;
    border: 1px dashed #263849;
    border-radius: 12px;
    background: transparent;
    color: #19b394;
    font: inherit;
    font-weight: 750;
  }

  input {
    width: 100%;
    height: 46px;
    border-radius: 12px;
    border: 1px solid #263849;
    background: #0d151d;
    color: #e8f0f6;
    padding: 0 13px;
    font-size: 16px;
    box-sizing: border-box;
  }

  input:focus {
    outline: 2px solid rgba(25, 179, 148, 0.35);
    border-color: #19b394;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .btn {
    border: 0;
    border-radius: 12px;
    height: 46px;
    padding: 0 16px;
    font-size: 15px;
    font-weight: 750;
    color: #07110f;
    background: #19b394;
    flex: 1;
  }

  .btn.secondary {
    background: #1a2a38;
    color: #e8f0f6;
    border: 1px solid #263849;
    flex: 0 0 auto;
  }

  .btn:disabled {
    opacity: 0.55;
  }

  .message {
    min-height: 22px;
    margin-top: 13px;
    font-size: 14px;
    color: #91a4b5;
    line-height: 1.45;
  }

  .message.error {
    color: #ff9b9b;
  }

  .message.ok {
    color: #7de2c8;
  }

  @media (min-width: 641px) and (max-width: 1024px) {
    .setup-card {
      width: min(560px, 100%);
      padding: 24px;
    }

    .networks {
      max-height: 42dvh;
    }
  }

  @media (max-width: 640px) {
    .setup-shell {
      align-items: flex-start;
      padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
        max(16px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    }

    .setup-card {
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    }

    .title {
      font-size: 22px;
    }

    .desc {
      font-size: 13px;
      margin-bottom: 14px;
    }

    .notice {
      font-size: 12.5px;
      padding: 11px 12px;
    }

    .status {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 12px;
      gap: 7px 10px;
    }

    .status b {
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .networks {
      max-height: 34dvh;
    }

    .net {
      min-height: 54px;
      padding: 13px 12px;
    }

    .net small {
      font-size: 12px;
    }

    .net-more {
      height: 46px;
    }

    .actions {
      flex-direction: column-reverse;
    }

    .btn,
    .btn.secondary {
      width: 100%;
      flex: 0 0 auto;
      height: 48px;
    }

    .message {
      font-size: 13px;
    }
  }
</style>

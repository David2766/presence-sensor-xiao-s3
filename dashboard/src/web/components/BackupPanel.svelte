<script lang="ts">
  import { onDestroy } from "svelte";
  import type { BackupIssue, BackupValidationResult } from "../../core/config-backup";
  import type { BackupRestoreProgressStep, BackupRestoreStage } from "../state/useBackupRestore.svelte";
  import type {
    FirmwareUploadProgress,
    WebApiKeyResult,
    WebSystemRebootResult,
    WebSystemResetOptions,
    WebSystemResetResult,
    WebSystemStatus
  } from "../types";

  type Props = {
    loaded: boolean;
    stage: BackupRestoreStage;
    filename: string;
    message: string;
    errors: BackupIssue[];
    warnings: BackupIssue[];
    summary: BackupValidationResult["summary"] | null;
    progressSteps: BackupRestoreProgressStep[];
    progressPercent: number;
    importZones: boolean;
    importFloorplan: boolean;
    importStats: boolean;
    canImportFloorplan: boolean;
    canImportStats: boolean;
    canConfirmImport: boolean;
    systemStatus: WebSystemStatus | null;
    systemStatusLoading: boolean;
    systemStatusError: string;
    demoMode?: boolean;
    issueText: (issue: BackupIssue) => string;
    onExport: () => void;
    onImportFile: (file: File | null) => void;
    onSetImportZones: (enabled: boolean) => void;
    onSetImportFloorplan: (enabled: boolean) => void;
    onSetImportStats: (enabled: boolean) => void;
    onConfirmImport: () => void | Promise<void>;
    onCancelImport: () => void;
    onGetSystemStatus?: () => Promise<WebSystemStatus>;
    onUploadFirmware?: (file: File, onProgress: (progress: FirmwareUploadProgress) => void) => Promise<void>;
    onGetApiKey?: () => Promise<WebApiKeyResult>;
    onResetSystem?: (options: WebSystemResetOptions) => Promise<WebSystemResetResult>;
    onRebootSystem?: () => Promise<WebSystemRebootResult>;
  };

  type FirmwareStatusSnapshot = {
    version?: string;
    buildTime?: string;
  } | null;

  let {
    loaded,
    stage,
    filename,
    message,
    errors,
    warnings,
    summary,
    progressSteps,
    progressPercent,
    importZones,
    importFloorplan,
    importStats,
    canImportFloorplan,
    canImportStats,
    canConfirmImport,
    systemStatus,
    systemStatusLoading,
    systemStatusError,
    demoMode = false,
    issueText,
    onExport,
    onImportFile,
    onSetImportZones,
    onSetImportFloorplan,
    onSetImportStats,
    onConfirmImport,
    onCancelImport,
    onGetSystemStatus,
    onUploadFirmware,
    onGetApiKey,
    onResetSystem,
    onRebootSystem
  }: Props = $props();

  let fileInput: HTMLInputElement | null = $state(null);
  let firmwareFileInput: HTMLInputElement | null = $state(null);
  let firmwareFile: File | null = $state(null);
  let firmwareFileName = $state("");
  let firmwareFileSize = $state(0);
  let firmwareUploadStage = $state<"idle" | "selected" | "uploading" | "verifying" | "success" | "error" | "verify-error">("idle");
  let firmwareUploadPercent = $state(0);
  let firmwareUploadLoaded = $state(0);
  let firmwareUploadTotal = $state(0);
  let firmwareUploadMessage = $state("");
  let resetOptionsOpen = $state(false);
  let resetIncludeSettings = $state(true);
  let resetIncludeWifi = $state(false);
  let resetIncludeStats = $state(false);
  let resetConfirmOpen = $state(false);
  let resetExecuting = $state(false);
  let rebootConfirmOpen = $state(false);
  let rebootExecuting = $state(false);
  let apiKeyVisible = $state(false);
  let apiKeyLoading = $state(false);
  let apiKeyValue = $state("");
  let apiKeyMessage = $state("");
  let apiKeyHideTimer: ReturnType<typeof setTimeout> | null = null;
  let demoNoticeOpen = $state(false);
  let demoNoticeTitle = $state("");
  let demoNoticeMessage = $state("");
  let bootGuardNow = $state(Date.now());
  let bootGuardSnapshotMs = $state(Date.now());
  let bootGuardUptimeAtSnapshot = $state(0);
  let componentDestroyed = false;

  function showDemoNotice(title: string, message: string): void {
    demoNoticeTitle = title;
    demoNoticeMessage = message;
    demoNoticeOpen = true;
  }

  function showPreparedNotice(title: string, message: string): void {
    showDemoNotice(title, message);
  }

  function clearApiKeyTimer(): void {
    if (apiKeyHideTimer) {
      clearTimeout(apiKeyHideTimer);
      apiKeyHideTimer = null;
    }
  }

  function hideApiKey(message = ""): void {
    clearApiKeyTimer();
    apiKeyVisible = false;
    apiKeyValue = "";
    apiKeyMessage = message;
  }

  function scheduleApiKeyHide(seconds = 30): void {
    clearApiKeyTimer();
    apiKeyHideTimer = setTimeout(() => {
      hideApiKey("API 키를 숨겼습니다.");
    }, Math.max(1, seconds) * 1000);
  }

  async function handleApiKeyReveal(): Promise<void> {
    if (apiKeyLoading) return;
    if (demoMode || !onGetApiKey) {
      showDemoNotice("데모에서는 API 키를 확인할 수 없습니다.", "API 키 확인은 실제 장치에서만 사용할 수 있습니다.");
      return;
    }

    apiKeyLoading = true;
    apiKeyMessage = "";
    try {
      const result = await onGetApiKey();
      apiKeyValue = result.apiKey;
      apiKeyVisible = true;
      apiKeyMessage = "30초 후 자동으로 숨겨집니다.";
      scheduleApiKeyHide(result.visibleSeconds ?? 30);
    } catch (error) {
      const message = error instanceof Error ? error.message : "API 키를 불러오지 못했습니다.";
      hideApiKey(message.includes("api_key_not_set") ? "저장된 API 키가 없습니다. API 키 생성 또는 재발급이 필요합니다." : message);
    } finally {
      apiKeyLoading = false;
    }
  }

  function legacyCopyText(value: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "0";
    textarea.style.top = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      textarea.setSelectionRange(0, value.length);
    } catch {
      // Ignore selection range errors on older browsers.
    }
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  async function handleApiKeyCopy(): Promise<void> {
    if (!apiKeyValue) return;
    let copied = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(apiKeyValue);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) copied = legacyCopyText(apiKeyValue);
    hideApiKey(copied ? "API 키를 복사했습니다." : "복사하지 못했습니다. 다시 확인해 주세요.");
  }

  onDestroy(() => {
    componentDestroyed = true;
    clearApiKeyTimer();
  });

  $effect(() => {
    if (!systemStatus?.boot?.initialGuardActive) return;
    const timer = setInterval(() => {
      bootGuardNow = Date.now();
    }, 1000);
    return () => clearInterval(timer);
  });

  $effect(() => {
    bootGuardSnapshotMs = Date.now();
    bootGuardNow = bootGuardSnapshotMs;
    bootGuardUptimeAtSnapshot = Math.max(0, Number(systemStatus?.firmware?.uptimeSeconds ?? 0));
  });

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function snapshotFirmwareStatus(status: WebSystemStatus | null): FirmwareStatusSnapshot {
    if (!status?.firmware) return null;
    return {
      version: status.firmware.version,
      buildTime: status.firmware.buildTime
    };
  }

  async function readFirmwareStatusSnapshot(): Promise<FirmwareStatusSnapshot> {
    if (!onGetSystemStatus) return snapshotFirmwareStatus(systemStatus);
    try {
      return snapshotFirmwareStatus(await onGetSystemStatus());
    } catch {
      return null;
    }
  }

  function firmwareStatusChanged(before: FirmwareStatusSnapshot, after: FirmwareStatusSnapshot): boolean | null {
    if (!after) return null;
    if (!before) return null;
    return after.version !== before.version || after.buildTime !== before.buildTime;
  }

  async function waitForFirmwareReboot(before: FirmwareStatusSnapshot): Promise<"changed" | "same" | "unknown" | "timeout"> {
    if (!onGetSystemStatus) return "unknown";

    const deadline = Date.now() + 180000;
    let attempts = 0;

    await wait(3000);

    while (Date.now() < deadline && !componentDestroyed) {
      attempts += 1;
      firmwareUploadMessage =
        attempts <= 2 ? "장치가 재부팅 중입니다." : attempts <= 8 ? "장치 응답을 기다리는 중입니다." : "새 펌웨어 적용 여부를 확인하는 중입니다.";

      try {
        const after = snapshotFirmwareStatus(await onGetSystemStatus());
        const changed = firmwareStatusChanged(before, after);
        if (changed === true) return "changed";
        if (changed === false) return "same";
        return "unknown";
      } catch {
        await wait(2000);
      }
    }

    return "timeout";
  }

  async function verifyFirmwareRebootAndReload(before: FirmwareStatusSnapshot): Promise<void> {
    firmwareUploadStage = "verifying";
    firmwareUploadPercent = 100;
    firmwareUploadLoaded = firmwareFileSize || firmwareUploadLoaded;
    firmwareUploadTotal = firmwareFileSize || firmwareUploadTotal;
    firmwareUploadMessage = "장치가 재부팅 중입니다.";

    const result = await waitForFirmwareReboot(before);
    if (componentDestroyed) return;

    if (result === "timeout") {
      firmwareUploadStage = "verify-error";
      firmwareUploadMessage = "장치 응답을 확인하지 못했습니다. 전원과 네트워크를 확인한 뒤 수동으로 새로고침하세요.";
      return;
    }

    firmwareUploadStage = "success";
    firmwareFile = null;
    firmwareUploadMessage =
      result === "changed"
        ? "업데이트가 적용되었습니다. 대시보드를 새로고침합니다."
        : result === "same"
          ? "장치가 다시 응답했습니다. 같은 버전의 펌웨어를 다시 설치했을 수 있습니다. 대시보드를 새로고침합니다."
          : "장치가 다시 응답했습니다. 대시보드를 새로고침합니다.";

    await wait(1000);
    if (!componentDestroyed) window.location.reload();
  }

  function openFilePicker(): void {
    if (demoMode) {
      showDemoNotice("데모에서는 복원할 수 없습니다.", "데모 페이지는 실제 장치 데이터를 덮어쓰지 않도록 복원 기능을 막아두었습니다.");
      return;
    }
    fileInput?.click();
  }

  function handleFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    if (demoMode) {
      input.value = "";
      showDemoNotice("데모에서는 복원할 수 없습니다.", "백업 파일 검증과 복원 API 호출은 실제 장치에서만 사용할 수 있습니다.");
      return;
    }
    onImportFile(input.files?.[0] || null);
    input.value = "";
  }

  function openFirmwareFilePicker(): void {
    if (firmwareUploadStage === "uploading" || firmwareUploadStage === "verifying") return;
    if (bootGuardActive) {
      showBootGuardNotice("펌웨어 업데이트");
      return;
    }
    if (demoMode) {
      showDemoNotice("데모에서는 업데이트할 수 없습니다.", "펌웨어 업로드는 장치를 재부팅할 수 있는 작업이라 데모에서는 API 호출을 모두 막아두었습니다.");
      return;
    }
    firmwareFileInput?.click();
  }

  function handleFirmwareAction(): void {
    if (firmwareUploadStage === "uploading" || firmwareUploadStage === "verifying") return;
    if (bootGuardActive) {
      showBootGuardNotice("펌웨어 업데이트");
      return;
    }
    if (firmwareUploadStage === "selected" && firmwareFile) {
      void uploadSelectedFirmware();
      return;
    }
    openFirmwareFilePicker();
  }

  function handleFirmwareFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = "";
    if (bootGuardActive) {
      showBootGuardNotice("펌웨어 업데이트");
      return;
    }
    if (demoMode) {
      showDemoNotice("데모에서는 업데이트할 수 없습니다.", "선택한 펌웨어 파일은 업로드되지 않습니다. 실제 장치에서만 업데이트를 진행할 수 있습니다.");
      return;
    }
    if (!file) return;

    firmwareFile = null;
    firmwareFileName = file.name;
    firmwareFileSize = file.size;
    firmwareUploadPercent = 0;
    firmwareUploadLoaded = 0;
    firmwareUploadTotal = file.size;

    if (!file.name.toLowerCase().endsWith(".bin")) {
      firmwareUploadStage = "error";
      firmwareUploadMessage = "ESPHome에서 생성한 .bin 펌웨어 파일만 업로드할 수 있습니다.";
      return;
    }

    if (Number.isFinite(systemStatus?.flash?.otaSlotBytes ?? NaN) && file.size > Number(systemStatus?.flash?.otaSlotBytes)) {
      firmwareUploadStage = "error";
      firmwareUploadMessage = `파일이 OTA 예비 공간보다 큽니다. ${formatBytes(file.size)} / ${formatBytes(systemStatus?.flash?.otaSlotBytes)}`;
      return;
    }

    if (!onUploadFirmware) {
      firmwareUploadStage = "error";
      firmwareUploadMessage = "펌웨어 업로드 API가 준비되지 않았습니다.";
      return;
    }

    firmwareFile = file;
    firmwareUploadStage = "selected";
    firmwareUploadMessage = "파일을 확인했습니다. 업로드 버튼을 누르면 업데이트를 시작합니다.";
  }

  async function uploadSelectedFirmware(): Promise<void> {
    if (!firmwareFile || !onUploadFirmware) return;
    const file = firmwareFile;
    const beforeStatus = await readFirmwareStatusSnapshot();
    firmwareUploadStage = "uploading";
    firmwareUploadMessage = "펌웨어를 업로드하는 중입니다. 업데이트 중에는 전원을 끄지 마세요.";
    try {
      await onUploadFirmware(file, (progress) => {
        firmwareUploadLoaded = progress.loaded;
        firmwareUploadTotal = progress.total;
        firmwareUploadPercent = progress.percent;
      });
      firmwareUploadPercent = 100;
      firmwareUploadLoaded = file.size;
      firmwareUploadTotal = file.size;
      await verifyFirmwareRebootAndReload(beforeStatus);
    } catch (error) {
      if (firmwareUploadPercent >= 95) {
        firmwareUploadPercent = 100;
        firmwareUploadLoaded = file.size;
        firmwareUploadTotal = file.size;
        firmwareUploadMessage = "업로드 응답이 끊겼습니다. 장치 응답을 확인합니다.";
        await verifyFirmwareRebootAndReload(beforeStatus);
        return;
      }
      firmwareUploadStage = "error";
      firmwareUploadMessage = error instanceof Error ? error.message : "펌웨어 업데이트에 실패했습니다.";
    }
  }

  function handleExport(): void {
    onExport();
  }

  function handleConfirmImport(): void {
    if (demoMode) {
      showDemoNotice("데모에서는 복원할 수 없습니다.", "선택한 백업 데이터는 실제 장치에서만 가져올 수 있습니다.");
      return;
    }
    onConfirmImport();
  }

  function handleCancelImport(): void {
    onCancelImport();
  }

  function handleImportZonesChange(event: Event): void {
    onSetImportZones((event.currentTarget as HTMLInputElement).checked);
  }

  function handleImportFloorplanChange(event: Event): void {
    onSetImportFloorplan((event.currentTarget as HTMLInputElement).checked);
  }

  function handleImportStatsChange(event: Event): void {
    onSetImportStats((event.currentTarget as HTMLInputElement).checked);
  }

  function handleResetOptionsOpen(): void {
    if (bootGuardActive) {
      showBootGuardNotice("초기화");
      return;
    }
    resetOptionsOpen = true;
  }

  function handleRebootConfirmOpen(): void {
    if (bootGuardActive) {
      showBootGuardNotice("재시작");
      return;
    }
    rebootConfirmOpen = true;
  }

  async function executeSystemReboot(): Promise<void> {
    if (rebootExecuting) return;
    if (bootGuardActive) {
      rebootConfirmOpen = false;
      showBootGuardNotice("재시작");
      return;
    }
    if (demoMode || !onRebootSystem) {
      rebootConfirmOpen = false;
      showDemoNotice("데모에서는 재시작할 수 없습니다.", "재시작 API는 실제 기기에서만 호출할 수 있습니다.");
      return;
    }

    rebootExecuting = true;
    try {
      const result = await onRebootSystem();
      rebootConfirmOpen = false;
      const seconds = Math.max(1, Math.round((result.rebootInMs ?? 2500) / 1000));
      showDemoNotice("재시작 요청 완료", `약 ${seconds}초 뒤 기기를 재시작합니다.`);
    } catch (error) {
      rebootConfirmOpen = false;
      showDemoNotice("재시작 실패", error instanceof Error ? error.message : "재시작 중 오류가 발생했습니다.");
    } finally {
      rebootExecuting = false;
    }
  }

  function handleResetSettingsChange(event: Event): void {
    resetIncludeSettings = (event.currentTarget as HTMLInputElement).checked;
  }

  function handleResetWifiChange(event: Event): void {
    resetIncludeWifi = (event.currentTarget as HTMLInputElement).checked;
  }

  function handleResetStatsChange(event: Event): void {
    resetIncludeStats = (event.currentTarget as HTMLInputElement).checked;
  }

  function handleResetConfirmRequest(): void {
    if (bootGuardActive) {
      showBootGuardNotice("초기화");
      return;
    }
    if (!resetIncludeSettings && !resetIncludeWifi && !resetIncludeStats) {
      showPreparedNotice("초기화 범위 선택 필요", "초기화할 항목을 하나 이상 선택해 주세요.");
      return;
    }

    resetConfirmOpen = true;
  }

  async function executeSystemReset(): Promise<void> {
    if (resetExecuting) return;
    if (bootGuardActive) {
      resetConfirmOpen = false;
      showBootGuardNotice("초기화");
      return;
    }
    if (demoMode || !onResetSystem) {
      resetConfirmOpen = false;
      showDemoNotice("데모에서는 초기화할 수 없습니다.", "초기화 API는 실제 기기에서만 호출할 수 있습니다.");
      return;
    }

    resetExecuting = true;
    try {
      const result = await onResetSystem({
        settings: resetIncludeSettings,
        wifi: resetIncludeWifi,
        stats: resetIncludeStats
      });
      resetConfirmOpen = false;
      resetOptionsOpen = false;
      const rebootText = result.rebootRequired
        ? ` 설정 마무리를 위해 약 ${Math.max(1, Math.round((result.rebootInMs ?? 2500) / 1000))}초 뒤 기기를 재부팅합니다.`
        : "";
      showDemoNotice("초기화 요청 완료", `선택한 항목을 초기화했습니다.${rebootText}`);
    } catch (error) {
      resetConfirmOpen = false;
      showDemoNotice("초기화 실패", error instanceof Error ? error.message : "초기화 중 오류가 발생했습니다.");
    } finally {
      resetExecuting = false;
    }
  }

  const importing = $derived(stage === "importing");
  const bootGuardSeconds = $derived(Math.max(1, Math.round(systemStatus?.boot?.guardSeconds ?? 60)));
  const bootGuardRemainingSeconds = $derived.by(() => {
    if (!systemStatus?.boot?.initialGuardActive) return 0;
    const elapsedSeconds = bootGuardUptimeAtSnapshot + Math.floor(Math.max(0, bootGuardNow - bootGuardSnapshotMs) / 1000);
    return Math.max(0, bootGuardSeconds - elapsedSeconds);
  });
  const bootGuardActive = $derived(bootGuardRemainingSeconds > 0);
  const bootGuardHint = $derived(
    bootGuardActive
      ? `부팅 직후 안전 확인 중입니다. ${bootGuardRemainingSeconds}초 후 사용할 수 있습니다.`
      : ""
  );
  const canConfirmReset = $derived(resetIncludeSettings || resetIncludeWifi || resetIncludeStats);
  const showRestoreProgress = $derived(progressSteps.length > 0 && (stage === "importing" || stage === "imported" || stage === "error"));

  function showBootGuardNotice(action: string): void {
    showPreparedNotice(
      "부팅 안정화 중",
      `${action}는 부팅 직후 ${bootGuardSeconds}초 동안 사용할 수 없습니다. OTA 롤백 감지와 장치 초기화를 안전하게 끝낸 뒤 다시 시도해 주세요.`
    );
  }

  function formatBytes(value: number | null | undefined): string {
    if (!Number.isFinite(value ?? NaN)) return "-";
    const bytes = Math.max(0, Number(value));
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round(bytes)}B`;
  }

  function formatPercent(used: number | null | undefined, total: number | null | undefined): string {
    if (!Number.isFinite(used ?? NaN) || !Number.isFinite(total ?? NaN) || Number(total) <= 0) return "-";
    return `${Math.round((Number(used) / Number(total)) * 100)}%`;
  }

  function subtractBytes(total: number | null | undefined, free: number | null | undefined): number | undefined {
    if (!Number.isFinite(total ?? NaN) || !Number.isFinite(free ?? NaN)) return undefined;
    return Math.max(0, Number(total) - Number(free));
  }

  function addBytes(...values: Array<number | null | undefined>): number | undefined {
    if (values.some((value) => !Number.isFinite(value ?? NaN))) return undefined;
    return values.reduce((sum, value) => sum + Number(value), 0);
  }

  function wifiSignalInfo(connected: boolean | undefined, rssi: number | null | undefined): { bars: number; label: string } {
    if (!connected || !Number.isFinite(rssi ?? NaN)) return { bars: 0, label: "연결 안 됨" };
    const value = Number(rssi);
    if (value >= -50) return { bars: 4, label: "매우 좋음" };
    if (value >= -60) return { bars: 3, label: "좋음" };
    if (value >= -70) return { bars: 2, label: "보통" };
    if (value >= -80) return { bars: 1, label: "약함" };
    return { bars: 1, label: "매우 약함" };
  }

  function formatUptime(seconds: number | null | undefined): string {
    if (!Number.isFinite(seconds ?? NaN)) return "-";
    const total = Math.max(0, Math.round(Number(seconds)));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
  }

  const firmwareVersion = $derived(systemStatus?.firmware?.version || "-");
  const dashboardVersion = $derived(systemStatus?.dashboard?.version || "-");
  const dataStorageUsedBytes = $derived(systemStatus?.flash?.storageUsedBytes ?? systemStatus?.storage?.usedBytes);
  const dataStorageTotalBytes = $derived(systemStatus?.flash?.storageTotalBytes ?? systemStatus?.storage?.totalBytes);
  const dataStorageUsedText = $derived(
    `${formatBytes(dataStorageUsedBytes)} / ${formatBytes(dataStorageTotalBytes)}`
  );
  const dataStoragePercentText = $derived(formatPercent(dataStorageUsedBytes, dataStorageTotalBytes));
  const firmwareSpaceText = $derived(
    `${formatBytes(systemStatus?.flash?.firmwareUsedBytes)} / ${formatBytes(systemStatus?.flash?.firmwareSlotBytes)}`
  );
  const flashOccupiedBytes = $derived(
    addBytes(systemStatus?.flash?.firmwareUsedBytes, systemStatus?.flash?.otaSlotBytes, dataStorageUsedBytes)
  );
  const flashOccupancyText = $derived(
    `${formatBytes(flashOccupiedBytes)} / ${formatBytes(systemStatus?.flash?.totalBytes)}`
  );
  const flashOccupancyPercentText = $derived(formatPercent(flashOccupiedBytes, systemStatus?.flash?.totalBytes));
  const internalRamTotalBytes = $derived(systemStatus?.memory?.internalTotalBytes);
  const internalRamFreeBytes = $derived(systemStatus?.memory?.internalFreeBytes ?? systemStatus?.memory?.freeHeap);
  const internalRamUsedBytes = $derived(subtractBytes(internalRamTotalBytes, internalRamFreeBytes));
  const internalRamText = $derived(`${formatBytes(internalRamUsedBytes)} / ${formatBytes(internalRamTotalBytes)}`);
  const internalRamPercentText = $derived(formatPercent(internalRamUsedBytes, internalRamTotalBytes));
  const externalRamTotalBytes = $derived(systemStatus?.memory?.externalTotalBytes ?? systemStatus?.memory?.psramTotal);
  const externalRamFreeBytes = $derived(systemStatus?.memory?.externalFreeBytes ?? systemStatus?.memory?.psramFree);
  const externalRamUsedBytes = $derived(subtractBytes(externalRamTotalBytes, externalRamFreeBytes));
  const externalRamText = $derived(`${formatBytes(externalRamUsedBytes)} / ${formatBytes(externalRamTotalBytes)}`);
  const externalRamPercentText = $derived(formatPercent(externalRamUsedBytes, externalRamTotalBytes));
  const minInternalRamText = $derived(formatBytes(systemStatus?.memory?.internalMinFreeBytes ?? systemStatus?.memory?.minFreeHeap));
  const wifiInfo = $derived(wifiSignalInfo(systemStatus?.wifi?.connected, systemStatus?.wifi?.rssi));
  const firmwareFileText = $derived(firmwareFileName ? `${firmwareFileName} · ${formatBytes(firmwareFileSize)}` : "선택 안 됨");
  const firmwareActionText = $derived(
    firmwareUploadStage === "uploading"
      ? "업로드 중"
      : firmwareUploadStage === "verifying"
        ? "응답 확인 중"
        : firmwareUploadStage === "selected"
          ? "업로드"
          : "수동으로 업데이트"
  );
  const firmwareUploadProgressText = $derived(
    `${firmwareUploadPercent}% · ${formatBytes(firmwareUploadLoaded)} / ${formatBytes(firmwareUploadTotal || firmwareFileSize)}`
  );
  const firmwareUploadReadyText = $derived(
    systemStatus?.flash?.otaSlotBytes
      ? `업로드할 .bin 파일을 선택하세요. OTA 예비 공간은 ${formatBytes(systemStatus.flash.otaSlotBytes)}입니다.`
      : "업로드할 .bin 파일을 선택하세요. OTA 예비 공간은 시스템 정보 조회 후 확인할 수 있습니다."
  );
</script>

<section class="backup-workspace">
  <section class="backup-section-row">
    <aside class="backup-side-panel">
      <div class="floorplan-workflow-card">
        <div>
          <strong>백업 / 복원</strong>
          <span>구역 설정, 오탐 보정 구역, 저장된 평면도와 이미지를 파일로 저장하거나 복원합니다.</span>
        </div>
        <dl class="floorplan-stored-summary">
          <div>
            <dt>상태</dt>
            <dd>{loaded ? "데이터 확인됨" : "로딩 중"}</dd>
          </div>
          <div>
            <dt>파일</dt>
            <dd>{filename || "선택 안 됨"}</dd>
          </div>
        </dl>
      </div>

      <div class="floorplan-stored-tools">
        <button type="button" disabled={!loaded || importing} onclick={handleExport}>백업하기</button>
        <button type="button" disabled={!loaded || importing} onclick={openFilePicker}>복원하기</button>
        <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={handleFileChange} />
      </div>
    </aside>

    <section class="backup-result-panel" aria-live="polite">
      <div class="floorplan-workflow-card">
        {#if message}
          <div class={`floorplan-status backup-message ${stage}`}>
            <strong>{filename || "백업 파일"}</strong>
            <span>{message}</span>
          </div>
        {:else}
          <div class="floorplan-empty-note backup-empty-state">
            <strong>백업 파일을 만들거나 복원할 파일을 선택하세요.</strong>
            <span>작업 결과와 가져올 데이터 선택 항목이 여기에 표시됩니다.</span>
          </div>
        {/if}

        {#if summary && (stage === "ready" || stage === "warning" || stage === "imported" || stage === "exported")}
          <dl class="backup-summary floorplan-stored-summary">
            <div>
              <dt>구역</dt>
              <dd>{summary.softwareZones}</dd>
            </div>
            <div>
              <dt>오탐 보정</dt>
              <dd>{summary.calibrationZones}</dd>
            </div>
            <div>
              <dt>필터/둔감/제외</dt>
              <dd>{summary.filterZones}/{summary.reducedZones}/{summary.disabledZones}</dd>
            </div>
            <div>
              <dt>평면도</dt>
              <dd>{summary.hasFloorplan ? `포함${summary.floorplanImageBytes ? ` · ${Math.round(summary.floorplanImageBytes / 1024)}KB` : ""}` : "없음"}</dd>
            </div>
            <div>
              <dt>통계</dt>
              <dd>
                {summary.hasStats
                  ? `포함 · 일별 ${summary.statsDailyDays}일${summary.hasHeatmap ? " · 히트맵" : ""}`
                  : "없음"}
              </dd>
            </div>
          </dl>
        {/if}

        {#if showRestoreProgress}
          <div class="backup-restore-progress floorplan-edit-tool-card" data-stage={stage}>
            <div class="backup-restore-progress-header">
              <strong>복원 진행</strong>
              <span>{progressPercent}%</span>
            </div>
            <div class="firmware-progress-track" aria-label="백업 복원 진행률">
              <i style={`width: ${progressPercent}%`}></i>
            </div>
            <ol>
              {#each progressSteps as step}
                <li data-status={step.status}>
                  <span>{step.label}</span>
                  <small>{step.detail}</small>
                </li>
              {/each}
            </ol>
          </div>
        {/if}

        {#if summary && (stage === "ready" || stage === "warning")}
          <div class="floorplan-edit-tool-card backup-import-options">
            <strong>가져올 데이터</strong>
            <label>
              <input type="checkbox" checked={importZones} disabled={importing} onchange={handleImportZonesChange} />
              <span>구역 설정과 오탐 보정 구역</span>
            </label>
            <label class:disabled={!canImportFloorplan}>
              <input
                type="checkbox"
                checked={importFloorplan}
                disabled={!canImportFloorplan || importing}
                onchange={handleImportFloorplanChange}
              />
              <span>평면도와 이미지</span>
            </label>
            <label class:disabled={!canImportStats}>
              <input
                type="checkbox"
                checked={importStats}
                disabled={!canImportStats || importing}
                onchange={handleImportStatsChange}
              />
              <span>통계 데이터와 히트맵</span>
            </label>
          </div>
        {/if}

        {#if errors.length > 0}
          <div class="backup-issues error">
            <strong>가져올 수 없는 이유</strong>
            <ul>
              {#each errors as error}
                <li>{issueText(error)}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if warnings.length > 0}
          <div class="backup-issues warn">
            <strong>확인이 필요한 항목</strong>
            <ul>
              {#each warnings as warning}
                <li>{issueText(warning)}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if stage === "ready" || stage === "warning" || stage === "importing"}
          <div class="floorplan-edit-tool-card backup-confirm">
            <p>가져오기를 진행하면 선택한 데이터만 현재 장치 설정에 덮어씁니다.</p>
            <div>
              <button type="button" class="danger-button" disabled={!canConfirmImport || importing} onclick={handleConfirmImport}>
                {importing ? "가져오는 중" : "선택한 데이터 가져오기"}
              </button>
              <button type="button" disabled={importing} onclick={handleCancelImport}>취소</button>
            </div>
          </div>
        {/if}
      </div>
    </section>
  </section>

  <div class="backup-section-divider"></div>

  <section class="backup-section-row">
    <aside class="backup-side-panel">
      <div class="floorplan-workflow-card">
        <div>
          <strong>펌웨어 업데이트</strong>
          <span>장치 펌웨어를 업데이트합니다. 자동 업데이트는 배포 방식 확정 후 연결합니다.</span>
        </div>
        <dl class="floorplan-stored-summary">
          <div>
            <dt>펌웨어</dt>
            <dd>{systemStatusLoading ? "확인 중" : firmwareVersion}</dd>
          </div>
          <div>
            <dt>대시보드</dt>
            <dd>{systemStatusLoading ? "확인 중" : dashboardVersion}</dd>
          </div>
          <div>
            <dt>파일</dt>
            <dd>{firmwareFileText}</dd>
          </div>
        </dl>
      </div>

      <div class="floorplan-stored-tools">
        <button type="button" disabled>펌웨어 업데이트</button>
        <button
          type="button"
          class:danger-button={firmwareUploadStage === "selected"}
          disabled={bootGuardActive || firmwareUploadStage === "uploading" || firmwareUploadStage === "verifying"}
          title={bootGuardHint || undefined}
          onclick={handleFirmwareAction}
        >
          {firmwareActionText}
        </button>
        <input bind:this={firmwareFileInput} type="file" accept=".bin,application/octet-stream" hidden onchange={handleFirmwareFileChange} />
      </div>
    </aside>

    <section class="backup-result-panel">
      <div class="floorplan-workflow-card">
        <div>
          <strong>펌웨어 업데이트</strong>
          <span>ESPHome에서 생성한 펌웨어 파일을 장치에 직접 업로드합니다.</span>
        </div>
        {#if firmwareUploadStage === "uploading"}
          <div class="firmware-update-status active">
            <strong>펌웨어를 업로드하는 중입니다</strong>
            <span>{firmwareUploadProgressText}</span>
            <div class="firmware-progress-track" aria-label="펌웨어 업로드 진행률">
              <i style={`width: ${firmwareUploadPercent}%`}></i>
            </div>
            <small>업데이트 중에는 전원을 끄거나 브라우저를 닫지 마세요.</small>
          </div>
        {:else if firmwareUploadStage === "verifying"}
          <div class="firmware-update-status active">
            <strong>장치 응답을 확인하는 중입니다</strong>
            <span>{firmwareUploadMessage}</span>
            <div class="firmware-progress-track" aria-label="펌웨어 재응답 확인 진행률">
              <i style="width: 100%"></i>
            </div>
            <small>재부팅 중에는 대시보드 연결이 잠시 끊길 수 있습니다.</small>
          </div>
        {:else if firmwareUploadStage === "success"}
          <div class="firmware-update-status success">
            <strong>업데이트 완료</strong>
            <span>{firmwareUploadMessage}</span>
            <small>재부팅 중에는 대시보드 연결이 잠시 끊길 수 있습니다.</small>
          </div>
        {:else if firmwareUploadStage === "verify-error"}
          <div class="firmware-update-status error">
            <strong>재응답 확인 실패</strong>
            <span>{firmwareUploadMessage}</span>
            <small>업데이트가 진행되었을 수 있습니다. 장치가 정상 동작하면 수동으로 새로고침하세요.</small>
          </div>
        {:else if firmwareUploadStage === "error"}
          <div class="firmware-update-status error">
            <strong>업데이트 실패</strong>
            <span>{firmwareUploadMessage}</span>
            <small>파일과 OTA 예비 공간을 확인한 뒤 다시 시도하세요.</small>
          </div>
        {:else if firmwareUploadStage === "selected"}
          <div class="firmware-update-status active">
            <strong>업로드 준비됨</strong>
            <span>{firmwareUploadMessage}</span>
            <small>{firmwareFileText} · 업로드를 누르면 장치 업데이트가 시작됩니다.</small>
          </div>
        {:else}
          <div class="floorplan-empty-note backup-empty-state">
            <strong>수동 업데이트 대기 중</strong>
            <span>{firmwareUploadReadyText}</span>
          </div>
        {/if}
      </div>
    </section>
  </section>

  <div class="backup-section-divider"></div>

  <section class="backup-section-row danger-zone-row">
    <aside class="backup-side-panel">
      <div class="floorplan-workflow-card danger-zone-card">
        <div>
          <strong>위험 구역</strong>
          <span>장치 연결, 보안 키, 저장된 설정을 되돌리는 작업입니다. 필요한 경우 먼저 백업을 만들어 두세요.</span>
        </div>
      </div>

      <div class="floorplan-stored-tools danger-zone-tools">
        <button type="button" disabled={apiKeyLoading} onclick={handleApiKeyReveal}>
          {apiKeyLoading ? "확인 중" : "API 키 확인"}
        </button>
        <button type="button" disabled>API 키 재발급</button>
        <button
          type="button"
          class="danger-button"
          disabled={bootGuardActive || rebootExecuting}
          title={bootGuardHint || undefined}
          onclick={handleRebootConfirmOpen}
        >
          장치 재시작
        </button>
        <button
          type="button"
          class="danger-button"
          disabled={bootGuardActive}
          title={bootGuardHint || undefined}
          onclick={handleResetOptionsOpen}
        >
          초기화
        </button>
      </div>
    </aside>

    <section class="backup-result-panel">
      <div class="floorplan-workflow-card danger-zone-card">
        <div>
          <strong>초기화 범위</strong>
          <span>초기화를 누른 뒤 아래 항목을 선택하고 확인 버튼을 누르면 최종 확인 팝업을 표시합니다.</span>
        </div>

        {#if apiKeyVisible}
          <div class="floorplan-edit-tool-card backup-import-options danger-reset-options">
            <strong>API 키</strong>
            <code class="api-key-value">{apiKeyValue}</code>
            <span>{apiKeyMessage}</span>
            <button type="button" onclick={handleApiKeyCopy}>복사</button>
          </div>
        {:else if apiKeyMessage}
          <div class="floorplan-empty-note backup-empty-state danger-reset-empty">
            <strong>API 키</strong>
            <span>{apiKeyMessage}</span>
          </div>
        {/if}

        {#if resetOptionsOpen}
          <div class="floorplan-edit-tool-card backup-import-options danger-reset-options">
            <strong>초기화할 항목</strong>
            <label>
              <input type="checkbox" checked={resetIncludeSettings} onchange={handleResetSettingsChange} />
              <span>설정 데이터: API 키, software/hardware zone, calibration/filter zone, 평면도, 가구 배치, 고급 설정</span>
            </label>
            <label>
              <input type="checkbox" checked={resetIncludeWifi} onchange={handleResetWifiChange} />
              <span>Wi-Fi 초기화: 저장된 Wi-Fi 정보를 삭제하고 설정 AP로 돌아가기</span>
            </label>
            <label>
              <input type="checkbox" checked={resetIncludeStats} onchange={handleResetStatsChange} />
              <span>통계/히트맵 데이터</span>
            </label>
            <button
              type="button"
              class="danger-button"
              disabled={bootGuardActive || !canConfirmReset}
              title={bootGuardHint || undefined}
              onclick={handleResetConfirmRequest}
            >
              선택한 항목 초기화
            </button>
          </div>
        {:else}
          <div class="floorplan-empty-note backup-empty-state danger-reset-empty">
            <strong>초기화 대기 중</strong>
            <span>왼쪽의 초기화 버튼을 누르면 초기화 범위를 선택할 수 있습니다.</span>
          </div>
        {/if}
      </div>
    </section>
  </section>

  <div class="backup-section-divider"></div>

  <section class="backup-section-row">
    <aside class="backup-side-panel">
      <div class="floorplan-workflow-card">
        <div>
          <strong>시스템 정보</strong>
          <span>ESP32의 메모리, 저장소, 무선 연결 상태를 확인합니다.</span>
        </div>
        <dl class="floorplan-stored-summary">
          <div>
            <dt>상태</dt>
            <dd>{systemStatusLoading ? "확인 중" : systemStatusError ? "확인 실패" : systemStatus ? "데이터 확인됨" : "대기 중"}</dd>
          </div>
          <div>
            <dt>Flash 점유량</dt>
            <dd>{systemStatus ? flashOccupancyPercentText : "-"}</dd>
          </div>
        </dl>
      </div>
    </aside>

    <section class="backup-result-panel">
      <div class="floorplan-workflow-card">
        <div>
          <strong>시스템 정보</strong>
          <span>{systemStatusLoading ? "장치 상태를 확인하는 중입니다." : "탭 진입 시 한 번 조회한 값입니다."}</span>
        </div>
        {#if systemStatusError}
          <div class="backup-issues error">
            <strong>시스템 정보를 읽지 못했습니다</strong>
            <ul>
              <li>{systemStatusError}</li>
            </ul>
          </div>
        {:else if systemStatus}
          <div class="backup-system-sections">
            <section class="backup-system-section">
              <strong>시스템</strong>
              <dl class="backup-system-list floorplan-stored-summary">
                <div>
                  <dt>펌웨어</dt>
                  <dd>{firmwareVersion}</dd>
                </div>
                <div>
                  <dt>대시보드</dt>
                  <dd>{dashboardVersion} · {formatBytes(systemStatus.dashboard?.gzipBytes)}</dd>
                </div>
                <div>
                  <dt>가동 시간</dt>
                  <dd>{formatUptime(systemStatus.firmware?.uptimeSeconds)}</dd>
                </div>
              </dl>
            </section>

            <section class="backup-system-section">
              <strong>저장 공간</strong>
              <dl class="backup-system-list floorplan-stored-summary">
                <div>
                  <dt>Flash 점유량</dt>
                  <dd>{flashOccupancyText} · {flashOccupancyPercentText} 사용 중</dd>
                </div>
                <div>
                  <dt>펌웨어 공간</dt>
                  <dd>{firmwareSpaceText}</dd>
                </div>
                <div>
                  <dt>OTA 예비 공간</dt>
                  <dd>{formatBytes(systemStatus.flash?.otaSlotBytes)}</dd>
                </div>
                <div>
                  <dt>저장 데이터</dt>
                  <dd>{dataStorageUsedText} · {dataStoragePercentText}</dd>
                </div>
                <div>
                  <dt>평면도</dt>
                  <dd>{formatBytes(systemStatus.storage?.floorplanConfigBytes)} / {formatBytes(systemStatus.storage?.floorplanImageBytes)}</dd>
                </div>
                <div>
                  <dt>설정/통계</dt>
                  <dd>{formatBytes(systemStatus.storage?.deviceConfigBytes)} / {formatBytes(systemStatus.storage?.statsBytes)}</dd>
                </div>
              </dl>
            </section>

            <section class="backup-system-section">
              <strong>RAM</strong>
              <dl class="backup-system-list floorplan-stored-summary">
                <div>
                  <dt>내부 RAM</dt>
                  <dd>{internalRamText} · {internalRamPercentText} 사용 중</dd>
                </div>
                <div>
                  <dt>최저 내부 RAM 여유</dt>
                  <dd>{minInternalRamText}</dd>
                </div>
                <div>
                  <dt>외장 RAM</dt>
                  <dd>{externalRamText} · {externalRamPercentText} 사용 중</dd>
                </div>
              </dl>
            </section>

            <section class="backup-system-section">
              <strong>네트워크</strong>
              <dl class="backup-system-list floorplan-stored-summary">
                <div>
                  <dt>Wi-Fi</dt>
                  <dd>
                    <span class="wifi-strength" aria-label={`Wi-Fi ${wifiInfo.label}`}>
                      {#each [0, 1, 2, 3] as index}
                        <span class:active={index < wifiInfo.bars}></span>
                      {/each}
                    </span>
                    {wifiInfo.label}{systemStatus.wifi?.connected ? ` · ${systemStatus.wifi?.rssi ?? "-"}dBm` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Bluetooth</dt>
                  <dd>{systemStatus.bluetooth?.enabled ? "활성" : "비활성"}</dd>
                </div>
              </dl>
            </section>
          </div>
        {:else}
          <div class="floorplan-empty-note backup-empty-state">
            <strong>시스템 정보 대기 중</strong>
            <span>관리 / 백업 탭에 진입하면 장치 상태를 한 번 확인합니다.</span>
          </div>
        {/if}
      </div>
    </section>
  </section>
</section>

{#if rebootConfirmOpen}
  <div class="demo-blocker-backdrop" role="presentation">
    <div class="demo-blocker-dialog" role="dialog" aria-modal="true" aria-labelledby="reboot-confirm-title">
      <div>
        <strong id="reboot-confirm-title">장치를 재시작할까요?</strong>
        <span>확인을 누르면 기기를 재시작합니다.</span>
      </div>
      <div class="demo-blocker-actions">
        <button type="button" disabled={rebootExecuting} onclick={() => (rebootConfirmOpen = false)}>취소</button>
        <button type="button" class="danger-button" disabled={rebootExecuting} onclick={executeSystemReboot}>
          {rebootExecuting ? "재시작 중..." : "재시작"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if resetConfirmOpen}
  <div class="demo-blocker-backdrop" role="presentation">
    <div class="demo-blocker-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title">
      <div>
        <strong id="reset-confirm-title">초기화를 진행할까요?</strong>
        <span>
          선택한 데이터가 삭제됩니다. 설정 데이터 또는 Wi-Fi 초기화를 포함하면 결과를 보낸 뒤 기기를 재부팅합니다.
        </span>
      </div>
      <div class="demo-blocker-actions">
        <button type="button" disabled={resetExecuting} onclick={() => (resetConfirmOpen = false)}>취소</button>
        <button type="button" class="danger-button" disabled={resetExecuting} onclick={executeSystemReset}>
          {resetExecuting ? "초기화 중..." : "초기화 진행"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if demoNoticeOpen}
  <div class="demo-blocker-backdrop" role="presentation">
    <div class="demo-blocker-dialog" role="dialog" aria-modal="true" aria-labelledby="demo-blocker-title">
      <div>
        <strong id="demo-blocker-title">{demoNoticeTitle}</strong>
        <span>{demoNoticeMessage}</span>
      </div>
      <button type="button" class="danger-button" onclick={() => (demoNoticeOpen = false)}>닫기</button>
    </div>
  </div>
{/if}

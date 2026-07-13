import {
  createConfigBackup,
  validateConfigBackupText,
  type BackupFloorplanData,
  type BackupDeviceInfo,
  type BackupIssue,
  type BackupValidationResult
} from "../../core/config-backup";
import { backupIssueMessage } from "../i18n/backup-issues";
import type { Messages } from "../i18n/types";
import { fallbackErrorMessage } from "../api/api-message";
import type { WebDeviceConfig, WebDeviceStats } from "../types";
import { downloadBlob } from "../utils/download";

export type BackupRestoreStage = "idle" | "blocked" | "warning" | "ready" | "importing" | "imported" | "exported" | "error";
export type BackupRestoreProgressStepId = "config" | "floorplan" | "stats";
export type BackupRestoreProgressStepStatus = "pending" | "active" | "done" | "error";

export interface BackupRestoreProgressStep {
  id: BackupRestoreProgressStepId;
  label: string;
  status: BackupRestoreProgressStepStatus;
  detail: string;
  percent: number;
}

interface BackupRestoreOptions {
  getConfig: () => WebDeviceConfig | null;
  applyConfig: (config: WebDeviceConfig) => Promise<void>;
  loadFloorplanBackup?: () => Promise<BackupFloorplanData | null>;
  applyFloorplanBackup?: (floorplan: BackupFloorplanData) => Promise<void>;
  loadStatsBackup?: () => Promise<WebDeviceStats | null>;
  applyStatsBackup?: (stats: WebDeviceStats, onProgress?: (progress: { loaded: number; total: number; percent: number }) => void) => Promise<void>;
  getDeviceInfo: () => BackupDeviceInfo;
  getMessages: () => Messages;
  setStatus: (message: string, tone: "ok" | "warn" | "error") => void;
  errorMessage: (error: unknown) => string;
}

export function createBackupRestore({
  getConfig,
  applyConfig,
  loadFloorplanBackup,
  applyFloorplanBackup,
  loadStatsBackup,
  applyStatsBackup,
  getDeviceInfo,
  getMessages,
  setStatus,
  errorMessage
}: BackupRestoreOptions) {
  let stage = $state<BackupRestoreStage>("idle");
  let filename = $state("");
  let message = $state("");
  let errors = $state<BackupIssue[]>([]);
  let warnings = $state<BackupIssue[]>([]);
  let summary = $state<BackupValidationResult["summary"] | null>(null);
  let pendingConfig = $state<WebDeviceConfig | null>(null);
  let pendingFloorplan = $state<BackupFloorplanData | null>(null);
  let pendingStats = $state<WebDeviceStats | null>(null);
  let importZones = $state(true);
  let importFloorplan = $state(false);
  let importStats = $state(false);
  let progressSteps = $state<BackupRestoreProgressStep[]>([]);
  let progressPercent = $state(0);
  let currentProgressStep = $state<BackupRestoreProgressStepId | "import">("import");

  function text() {
    return getMessages().backup;
  }

  async function exportBackup(): Promise<void> {
    const config = getConfig();
    if (!config) {
      setStatus(text().exportConfigNotReady, "warn");
      return;
    }

    try {
      const floorplan = loadFloorplanBackup ? await loadFloorplanBackup() : null;
      const stats = loadStatsBackup ? await loadStatsBackup() : null;
      const backup = await createConfigBackup(config, getDeviceInfo(), floorplan ?? undefined, stats ?? undefined);
      const backupText = `${JSON.stringify(backup, null, 2)}\n`;
      const blob = new Blob([backupText], { type: "application/json" });
      const downloadFilename = `radar-zone-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(blob, downloadFilename);
      stage = "exported";
      filename = downloadFilename;
      message = text().exportDoneMessage;
      errors = [];
      warnings = [];
      summary = summarizeBackupConfig(config, floorplan, stats);
      pendingConfig = null;
      pendingFloorplan = null;
      pendingStats = null;
      importZones = true;
      importFloorplan = Boolean(floorplan);
      importStats = Boolean(stats);
      setStatus(text().exportDoneStatus, "ok");
    } catch (error) {
      stage = "error";
      filename = "";
      message = text().exportFailed(errorMessage(error));
      errors = [{ path: "export", message }];
      warnings = [];
      summary = null;
      setStatus(message, "error");
    }
  }

  async function readImportFile(file: File | null): Promise<void> {
    resetImportState();
    if (!file) return;

    filename = file.name;
    if (!file.name.toLowerCase().endsWith(".json")) {
      stage = "blocked";
      message = text().importJsonOnly;
      errors = [
        {
          path: "$file",
          message: text().importJsonExtensionError,
          detail: file.name
        }
      ];
      setStatus(message, "error");
      return;
    }

    try {
      const fileText = await file.text();
      const result = await validateConfigBackupText(fileText);
      errors = result.errors;
      warnings = result.warnings;
      summary = result.summary;
      pendingConfig = result.config;
      pendingFloorplan = result.floorplan;
      pendingStats = result.stats;
      importZones = Boolean(pendingConfig);
      importFloorplan = Boolean(pendingFloorplan && applyFloorplanBackup);
      importStats = false;

      if (errors.length > 0 || !pendingConfig) {
        stage = "blocked";
        message = text().importBlockedMessage;
        setStatus(text().importValidationFailedStatus, "error");
        return;
      }

      if (warnings.length > 0) {
        stage = "warning";
        message = text().importWarningMessage;
        setStatus(text().importWarningStatus, "warn");
        return;
      }

      stage = "ready";
      message = text().importReadyMessage;
      setStatus(text().importReadyStatus, "warn");
    } catch (error) {
      stage = "error";
      message = text().importReadFailed(fallbackErrorMessage(error));
      errors = [{ path: "$file", message }];
      setStatus(message, "error");
    }
  }

  async function confirmImport(): Promise<void> {
    if (!pendingConfig || (!importZones && !importFloorplan && !importStats)) return;
    try {
      stage = "importing";
      errors = [];
      warnings = [];
      message = text().importPreparing;
      currentProgressStep = "import";
      initializeProgressSteps();
      setStatus(text().importRunningStatus, "warn");

      if (importZones) {
        message = text().importConfigRunning;
        activateProgressStep("config", message);
        await applyConfig(pendingConfig);
        completeProgressStep("config", text().importConfigDone);
      }
      if (importFloorplan && pendingFloorplan && applyFloorplanBackup) {
        message = pendingFloorplan.image
          ? text().importFloorplanWithImageRunning
          : text().importFloorplanConfigRunning;
        activateProgressStep("floorplan", message);
        await applyFloorplanBackup(pendingFloorplan);
        completeProgressStep("floorplan", text().importFloorplanDone);
      }
      if (importStats && pendingStats && applyStatsBackup) {
        message = text().importStatsRunning;
        activateProgressStep("stats", message);
        await applyStatsBackup(pendingStats, (progress) => {
          updateProgressStep("stats", "active", text().importStatsUploading(progress.percent), progress.percent);
          updateOverallProgress("stats", progress.percent);
        });
        completeProgressStep("stats", text().importStatsDone);
      }
      stage = "imported";
      message = text().importDoneMessage(
        [importZones ? text().itemSettings : "", importFloorplan ? text().itemFloorplan : "", importStats ? text().itemStats : ""]
          .filter(Boolean)
      );
      errors = [];
      warnings = [];
      pendingConfig = null;
      pendingFloorplan = null;
      pendingStats = null;
      importZones = true;
      importFloorplan = false;
      importStats = false;
      setStatus(text().importDoneStatus, "ok");
    } catch (error) {
      stage = "error";
      message = text().importFailed(errorMessage(error));
      if (currentProgressStep !== "import") {
        updateProgressStep(currentProgressStep, "error", message, progressSteps.find((step) => step.id === currentProgressStep)?.percent ?? 0);
      }
      errors = [{ path: currentProgressStep, message }];
      setStatus(message, "error");
    }
  }

  function cancelImport(): void {
    resetImportState();
    setStatus(text().importCancelledStatus, "warn");
  }

  function resetImportState(): void {
    stage = "idle";
    filename = "";
    message = "";
    errors = [];
    warnings = [];
    summary = null;
    pendingConfig = null;
    pendingFloorplan = null;
    pendingStats = null;
    importZones = true;
    importFloorplan = false;
    importStats = false;
    progressSteps = [];
    progressPercent = 0;
    currentProgressStep = "import";
  }

  function setImportZones(enabled: boolean): void {
    importZones = enabled;
  }

  function setImportFloorplan(enabled: boolean): void {
    importFloorplan = enabled && Boolean(pendingFloorplan && applyFloorplanBackup);
  }

  function setImportStats(enabled: boolean): void {
    importStats = enabled && Boolean(pendingStats && applyStatsBackup);
  }

  function issueText(issue: BackupIssue): string {
    return backupIssueMessage(getMessages(), issue);
  }

  function initializeProgressSteps(): void {
    progressSteps = [
      importZones
        ? {
            id: "config",
            label: text().progressConfig,
            status: "pending",
            detail: text().progressWaiting,
            percent: 0
          }
        : null,
      importFloorplan
        ? {
            id: "floorplan",
            label: text().progressFloorplan,
            status: "pending",
            detail: text().progressWaiting,
            percent: 0
          }
        : null,
      importStats
        ? {
            id: "stats",
            label: text().progressStats,
            status: "pending",
            detail: text().progressWaiting,
            percent: 0
          }
        : null
    ].filter((step): step is BackupRestoreProgressStep => Boolean(step));
    progressPercent = 0;
  }

  function activateProgressStep(id: BackupRestoreProgressStepId, detail: string): void {
    currentProgressStep = id;
    updateProgressStep(id, "active", detail, 0);
    updateOverallProgress(id, 0);
  }

  function completeProgressStep(id: BackupRestoreProgressStepId, detail: string): void {
    updateProgressStep(id, "done", detail, 100);
    updateOverallProgress(id, 100);
  }

  function updateProgressStep(
    id: BackupRestoreProgressStepId,
    status: BackupRestoreProgressStepStatus,
    detail: string,
    percent: number
  ): void {
    progressSteps = progressSteps.map((step) =>
      step.id === id
        ? {
            ...step,
            status,
            detail,
            percent: Math.min(100, Math.max(0, Math.round(percent)))
          }
        : step
    );
  }

  function updateOverallProgress(id: BackupRestoreProgressStepId, stepPercent: number): void {
    const index = progressSteps.findIndex((step) => step.id === id);
    if (index < 0 || progressSteps.length === 0) return;
    progressPercent = Math.min(
      100,
      Math.max(0, Math.round(((index + Math.min(100, Math.max(0, stepPercent)) / 100) / progressSteps.length) * 100))
    );
  }

  return {
    get stage() {
      return stage;
    },
    get filename() {
      return filename;
    },
    get message() {
      return message;
    },
    get errors() {
      return errors;
    },
    get warnings() {
      return warnings;
    },
    get summary() {
      return summary;
    },
    get importZones() {
      return importZones;
    },
    get importFloorplan() {
      return importFloorplan;
    },
    get importStats() {
      return importStats;
    },
    get canImportFloorplan() {
      return Boolean(pendingFloorplan && applyFloorplanBackup);
    },
    get canImportStats() {
      return Boolean(pendingStats && applyStatsBackup);
    },
    get canConfirmImport() {
      return Boolean(pendingConfig) && (stage === "ready" || stage === "warning") && (importZones || importFloorplan || importStats);
    },
    get importing() {
      return stage === "importing";
    },
    get progressSteps() {
      return progressSteps;
    },
    get progressPercent() {
      return progressPercent;
    },
    exportBackup,
    readImportFile,
    confirmImport,
    cancelImport,
    setImportZones,
    setImportFloorplan,
    setImportStats,
    issueText
  };
}

function summarizeBackupConfig(
  config: WebDeviceConfig,
  floorplan: BackupFloorplanData | null,
  stats: WebDeviceStats | null
): BackupValidationResult["summary"] {
  const allZones = [...config.zones, ...(config.calibrationZones || [])];
  return {
    softwareZones: config.zones.length,
    calibrationZones: config.calibrationZones?.length || 0,
    filterZones: allZones.filter((zone) => zone.type === "filter").length,
    reducedZones: allZones.filter((zone) => zone.type === "reduced").length,
    disabledZones: allZones.filter((zone) => zone.type === "disabled").length,
    hasFloorplan: Boolean(floorplan?.document),
    floorplanImageBytes: floorplan?.image?.bytes ?? 0,
    hasStats: Boolean(stats),
    statsDailyDays: stats?.daily?.filter(Boolean).length ?? 0,
    hasHeatmap: Boolean(stats?.heatmap)
  };
}

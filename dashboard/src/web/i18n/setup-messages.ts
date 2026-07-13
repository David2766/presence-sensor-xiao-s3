import { dashboardSetupCatalog } from "./setup-messages.generated";
import type { LanguageCode, Messages } from "./types";

type SetupCatalogSection = Record<string, string>;
type SetupCatalog = Record<
  LanguageCode,
  {
    shared: SetupCatalogSection;
    demo: SetupCatalogSection;
  }
>;

const setupCatalog = dashboardSetupCatalog as SetupCatalog;

export function formatSetupMessage(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : placeholder
  );
}

export function createSetupMessages(language: LanguageCode): Messages["setup"] {
  const { shared, demo } = setupCatalog[language];

  return {
    title: demo.title,
    connect: shared.connect,
    wifiPassword: shared.password,
    wifiListLoaded: demo.wifiListLoaded,
    copy: demo.copy,
    copied: shared.copied,
    check: demo.check,
    signalStrong: shared.signalStrong,
    signalNormal: shared.signalNormal,
    signalWeak: shared.signalWeak,
    openWifiUnsupportedMessage: shared.openWifiUnsupportedMessage,
    wifiSelectedMessage: demo.wifiSelectedMessage,
    selectWifiAgain: demo.selectWifiAgain,
    demoListRefreshed: demo.demoListRefreshed,
    selectWifi: demo.selectWifi,
    passwordMinLength: demo.passwordMinLength,
    passwordMaxLength: demo.passwordMaxLength,
    apiKeyChecked: shared.apiKeyCheckedMessage,
    checkingWifi: shared.checkingConnection,
    wifiConnected: demo.wifiConnectedMessage,
    finishingSetup: demo.finishingSetupMessage,
    demoDashboardReady: demo.demoDashboardReady,
    setupComplete: shared.setupComplete,
    wifiConnectedTitle: shared.wifiConnectedTitle,
    demoDescription: demo.demoDescription,
    nextStep: demo.nextStep,
    nextStepDescription: demo.nextStepDescription,
    deviceIp: shared.deviceIp,
    dashboard: shared.dashboard,
    finishingCountdown: (seconds) =>
      formatSetupMessage(shared.finishingCountdown, { seconds }),
    openDemoDashboard: demo.openDemoDashboard,
    prepareDashboard: shared.prepareDashboard,
    initialWifiSetup: shared.initialWifiSetup,
    demoIntro: demo.demoIntro,
    demoNotice: demo.demoNotice,
    status: shared.status,
    waitingSetup: shared.waitingSetup,
    setupAddress: shared.setupAddress,
    wifiList: shared.wifiList,
    lockedNetworkPrefix: shared.lockedNetworkPrefix,
    openWifiUnsupportedPrefix: shared.openWifiUnsupportedPrefix,
    collapse: shared.collapse,
    showMore: (count) => formatSetupMessage(shared.showMore, { count }),
    wifiName: demo.wifiName,
    change: demo.change,
    refresh: shared.refresh,
    apiKeyTitle: demo.apiKeyTitle,
    apiKeyDescription: demo.apiKeyDescription,
    apiKeyWarning: shared.apiKeyContinueWithKey,
    wifiConnectingTitle: demo.wifiConnectingTitle,
    wifiConnectingDescription: demo.wifiConnectingDescription
  };
}

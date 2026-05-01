import type { EchoSettings } from "../storage/settingsRepository";

export interface AppBehaviorDeps {
  getLoginItemSettings?: () => { openAtLogin: boolean };
  setLoginItemSettings: (settings: { openAtLogin: boolean }) => void;
  dock?: {
    show: () => void;
    hide: () => void;
  };
}

export function applyAppBehaviorSettings(settings: EchoSettings, deps: AppBehaviorDeps) {
  const currentLoginItemSettings = deps.getLoginItemSettings?.();
  if (!currentLoginItemSettings || currentLoginItemSettings.openAtLogin !== settings.launchAtLogin) {
    deps.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  }

  if (settings.showDockIcon) {
    deps.dock?.show();
    return;
  }

  deps.dock?.hide();
}

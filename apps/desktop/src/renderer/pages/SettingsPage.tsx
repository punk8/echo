import type { PermissionStatusSnapshot } from "../../main/platform/permissions";
import type { ProviderStatus } from "../../main/dictation/providerStatus";
import type { EchoSettings } from "../../main/storage/settingsRepository";

export function SettingsPage({
  settings,
  providerStatus,
  permissions = { microphone: "unknown", accessibility: "denied" },
  onSave,
  onRestoreDefaultShortcut,
  onRequestMicrophone = () => undefined,
  onRequestAccessibility = () => undefined
}: {
  settings: EchoSettings;
  providerStatus: ProviderStatus;
  permissions?: PermissionStatusSnapshot;
  onSave: (settings: Partial<EchoSettings>) => void;
  onRestoreDefaultShortcut: () => void;
  onRequestMicrophone?: () => void;
  onRequestAccessibility?: () => void;
}) {
  return (
    <section className="page-stack settings-page">
      <header className="page-header compact-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="settings-grid">
        <label className="shortcut-row">
          Shortcut
          <span>
            <input value={settings.shortcut} onChange={(event) => onSave({ shortcut: event.target.value })} />
            <button type="button" className="secondary-button" onClick={onRestoreDefaultShortcut}>
              Restore Default
            </button>
          </span>
        </label>
        <label>
          Microphone
          <select
            value={settings.microphoneDeviceId}
            onChange={(event) => onSave({ microphoneDeviceId: event.target.value })}
          >
            <option value="system">System default</option>
          </select>
        </label>
        <PermissionRow
          label="Microphone Permission"
          value={permissions.microphone}
          actionLabel="Request"
          onRequest={onRequestMicrophone}
        />
        <PermissionRow
          label="Accessibility Permission"
          value={permissions.accessibility}
          actionLabel="Open Prompt"
          onRequest={onRequestAccessibility}
        />
        <label>
          Language
          <select value={settings.language} onChange={(event) => onSave({ language: event.target.value })}>
            <option value="auto">Auto</option>
            <option value="zh">Chinese</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          Provider
          <span className="provider-status">
            <strong>{providerStatus.reachable ? "Local API reachable" : "Local API offline"}</strong>
            <small>{providerStatus.apiBaseUrl}</small>
          </span>
        </label>
        <label>
          Output Style
          <select
            value={settings.outputStyle}
            onChange={(event) => onSave({ outputStyle: event.target.value as EchoSettings["outputStyle"] })}
          >
            <option value="literal">Literal</option>
            <option value="balanced">Balanced</option>
            <option value="polished">Polished</option>
          </select>
        </label>
        <label>
          Retention
          <select value={settings.historyRetention} onChange={(event) => onSave({ historyRetention: event.target.value as EchoSettings["historyRetention"] })}>
            <option value="24_hours">24 hours</option>
            <option value="1_week">1 week</option>
            <option value="1_month">1 month</option>
            <option value="forever">Forever</option>
            <option value="never">Never</option>
          </select>
        </label>
        <label className="toggle-row">
          Interaction sounds
          <input
            type="checkbox"
            checked={settings.interactionSounds}
            onChange={(event) => onSave({ interactionSounds: event.target.checked })}
          />
        </label>
        <label className="toggle-row">
          Mute other audio
          <input
            type="checkbox"
            checked={settings.muteOtherAudioWhileDictating}
            onChange={(event) => onSave({ muteOtherAudioWhileDictating: event.target.checked })}
          />
        </label>
        <label className="toggle-row">
          Launch at login
          <input
            type="checkbox"
            checked={settings.launchAtLogin}
            onChange={(event) => onSave({ launchAtLogin: event.target.checked })}
          />
        </label>
        <label className="toggle-row">
          Show Dock icon
          <input
            type="checkbox"
            checked={settings.showDockIcon}
            onChange={(event) => onSave({ showDockIcon: event.target.checked })}
          />
        </label>
      </section>
    </section>
  );
}

function PermissionRow({
  label,
  value,
  actionLabel,
  onRequest
}: {
  label: string;
  value: string;
  actionLabel: string;
  onRequest: () => void;
}) {
  return (
    <label className="permission-row">
      {label}
      <span>
        <strong>{formatPermission(value)}</strong>
        <button type="button" className="secondary-button" onClick={onRequest}>
          {actionLabel}
        </button>
      </span>
    </label>
  );
}

function formatPermission(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

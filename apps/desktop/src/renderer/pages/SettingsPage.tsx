import type { PermissionStatusSnapshot } from "../../main/platform/permissions";
import type { ProviderStatus } from "../../main/dictation/providerStatus";
import type { EchoSettings } from "../../main/storage/settingsRepository";
import type { MicrophoneDevice } from "../recording/audioDevices";

const systemDefaultDevice: MicrophoneDevice = {
  id: "system",
  label: "System default"
};

export function SettingsPage({
  settings,
  providerStatus,
  microphoneDevices = [systemDefaultDevice],
  permissions = { microphone: "unknown", accessibility: "denied" },
  onSave,
  onRestoreDefaultShortcut,
  onRequestMicrophone = () => undefined,
  onRequestAccessibility = () => undefined
}: {
  settings: EchoSettings;
  providerStatus: ProviderStatus;
  microphoneDevices?: MicrophoneDevice[];
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
            {withSelectedMicrophone(settings.microphoneDeviceId, microphoneDevices).map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
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
            <small>{formatProviderDetail(providerStatus)}</small>
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

      <section className="privacy-summary" aria-labelledby="privacy-heading">
        <div>
          <p className="eyebrow">Privacy</p>
          <h2 id="privacy-heading">Privacy and retention</h2>
        </div>
        <ul>
          <li>
            Audio is sent to the configured speech provider, then refined text is generated by the configured language
            model.
          </li>
          <li>
            History and recordings stay on this Mac according to the selected retention setting:{" "}
            {formatRetention(settings.historyRetention)}.
          </li>
          <li>Provider keys stay in the backend environment and are never shown in the renderer.</li>
          <li>Echo does not enable model training on dictations.</li>
        </ul>
      </section>
    </section>
  );
}

function withSelectedMicrophone(selectedId: string, devices: MicrophoneDevice[]) {
  if (devices.some((device) => device.id === selectedId)) {
    return devices;
  }
  return [
    ...devices,
    {
      id: selectedId,
      label: "Selected microphone unavailable"
    }
  ];
}

function formatProviderDetail(providerStatus: ProviderStatus) {
  if (providerStatus.errorCode) {
    return formatProviderError(providerStatus.errorCode);
  }
  if (providerStatus.asr && providerStatus.llm) {
    return `${providerStatus.asr} / ${providerStatus.llm}`;
  }
  return providerStatus.apiBaseUrl;
}

function formatProviderError(errorCode: string) {
  switch (errorCode) {
    case "config.llm_model_missing":
      return "LLM configuration missing. Set LLM_MODEL.";
    case "config.llm_key_missing":
      return "LLM configuration missing. Set LLM_API_KEY or API_KEY.";
    case "config.llm_missing":
      return "LLM configuration missing. Set LLM_MODEL and LLM_API_KEY.";
    case "config.asr_key_missing":
      return "ASR configuration missing. Set ASR_API_KEY or API_KEY.";
    case "config.asr_missing":
      return "ASR configuration missing. Set ASR_API_KEY or API_KEY.";
    default:
      return `Provider startup error: ${errorCode}`;
  }
}

function formatRetention(value: EchoSettings["historyRetention"]) {
  switch (value) {
    case "24_hours":
      return "24 hours";
    case "1_week":
      return "1 week";
    case "1_month":
      return "1 month";
    case "forever":
      return "forever";
    case "never":
      return "never";
  }
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

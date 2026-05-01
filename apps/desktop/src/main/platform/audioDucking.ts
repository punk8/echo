import { execFile } from "node:child_process";

export interface AudioDucker {
  duck: () => Promise<void>;
  restore: () => Promise<void>;
}

export interface AudioDuckerDeps {
  runAppleScript?: (script: string) => Promise<string>;
}

interface OutputAudioState {
  volume: number;
  muted: boolean;
}

const captureOutputStateScript =
  'set currentSettings to get volume settings\nreturn (output volume of currentSettings as string) & "," & (output muted of currentSettings as string)';

export function createSystemAudioDucker(deps: AudioDuckerDeps = {}): AudioDucker {
  const runAppleScript = deps.runAppleScript ?? runOsascript;
  let capturedState: OutputAudioState | undefined;

  return {
    async duck() {
      if (capturedState) {
        return;
      }

      const state = parseOutputAudioState(await runAppleScript(captureOutputStateScript));
      capturedState = state;

      try {
        await runAppleScript("set volume with output muted");
      } catch (error) {
        capturedState = undefined;
        throw error;
      }
    },

    async restore() {
      if (!capturedState) {
        return;
      }

      const state = capturedState;
      await runAppleScript(buildRestoreScript(state));
      capturedState = undefined;
    }
  };
}

function parseOutputAudioState(value: string): OutputAudioState {
  const [rawVolume, rawMuted] = value.trim().split(",");
  const volume = Number.parseInt(rawVolume ?? "", 10);

  if (!Number.isFinite(volume)) {
    throw new Error("audio.ducking_invalid_volume");
  }

  return {
    volume: Math.max(0, Math.min(100, volume)),
    muted: rawMuted?.trim().toLowerCase() === "true"
  };
}

function buildRestoreScript(state: OutputAudioState) {
  const muteCommand = state.muted ? "set volume with output muted" : "set volume without output muted";
  return `set volume output volume ${state.volume}\n${muteCommand}`;
}

function runOsascript(script: string) {
  return new Promise<string>((resolve, reject) => {
    execFile("osascript", ["-e", script], { timeout: 3000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

import { globalShortcut } from "electron";

export const DEFAULT_DICTATION_SHORTCUT = "Alt+Space";

export interface RegisterShortcutOptions {
  accelerator?: string;
  onToggle: () => void;
  shortcutApi?: Pick<typeof globalShortcut, "register" | "unregister">;
}

export type ShortcutRegistrationResult =
  | { registered: true; accelerator: string }
  | { registered: false; accelerator: string; code: "shortcut.conflict"; message: string };

export function registerDictationShortcut(options: RegisterShortcutOptions): ShortcutRegistrationResult {
  const accelerator = options.accelerator ?? DEFAULT_DICTATION_SHORTCUT;
  const shortcutApi = options.shortcutApi ?? globalShortcut;

  shortcutApi.unregister(accelerator);
  const registered = shortcutApi.register(accelerator, options.onToggle);

  if (!registered) {
    return {
      registered: false,
      accelerator,
      code: "shortcut.conflict",
      message: `Shortcut ${accelerator} is already in use.`
    };
  }

  return { registered: true, accelerator };
}

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

export interface DictationShortcutControllerOptions extends RegisterShortcutOptions {
  initialAccelerator?: string;
}

export function createDictationShortcutController(options: DictationShortcutControllerOptions) {
  const shortcutApi = options.shortcutApi ?? globalShortcut;
  let activeAccelerator = options.initialAccelerator ?? options.accelerator ?? DEFAULT_DICTATION_SHORTCUT;

  return {
    registerInitial() {
      const result = registerDictationShortcut({
        accelerator: activeAccelerator,
        onToggle: options.onToggle,
        shortcutApi
      });
      if (result.registered) {
        activeAccelerator = result.accelerator;
      }
      return result;
    },

    replaceShortcut(nextAccelerator: string): ShortcutRegistrationResult {
      if (nextAccelerator === activeAccelerator) {
        return { registered: true, accelerator: activeAccelerator };
      }

      const previous = activeAccelerator;
      shortcutApi.unregister(previous);
      const registered = shortcutApi.register(nextAccelerator, options.onToggle);
      if (registered) {
        activeAccelerator = nextAccelerator;
        return { registered: true, accelerator: nextAccelerator };
      }

      shortcutApi.register(previous, options.onToggle);
      return {
        registered: false,
        accelerator: nextAccelerator,
        code: "shortcut.conflict",
        message: `Shortcut ${nextAccelerator} is already in use.`
      };
    },

    getAccelerator() {
      return activeAccelerator;
    }
  };
}

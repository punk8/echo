import { describe, expect, it, vi } from "vitest";
import { createDictationShortcutController } from "./shortcut";

describe("createDictationShortcutController", () => {
  it("replaces the active shortcut and unregisters the previous accelerator", () => {
    const shortcutApi = {
      register: vi.fn(() => true),
      unregister: vi.fn()
    };
    const controller = createDictationShortcutController({
      initialAccelerator: "Alt+Space",
      onToggle: vi.fn(),
      shortcutApi
    });

    controller.registerInitial();
    const result = controller.replaceShortcut("CommandOrControl+Space");

    expect(result).toEqual({ registered: true, accelerator: "CommandOrControl+Space" });
    expect(shortcutApi.unregister).toHaveBeenCalledWith("Alt+Space");
    expect(shortcutApi.register).toHaveBeenLastCalledWith("CommandOrControl+Space", expect.any(Function));
  });

  it("restores the previous shortcut when replacement conflicts", () => {
    const shortcutApi = {
      register: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(true),
      unregister: vi.fn()
    };
    const controller = createDictationShortcutController({
      initialAccelerator: "Alt+Space",
      onToggle: vi.fn(),
      shortcutApi
    });

    controller.registerInitial();
    const result = controller.replaceShortcut("CommandOrControl+Space");

    expect(result).toMatchObject({ registered: false, code: "shortcut.conflict" });
    expect(shortcutApi.register).toHaveBeenLastCalledWith("Alt+Space", expect.any(Function));
    expect(controller.getAccelerator()).toBe("Alt+Space");
  });
});

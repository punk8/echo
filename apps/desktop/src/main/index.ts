import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { processDictation } from "./dictation/backendClient";
import { ensureLocalApiRuntime, type LocalApiRuntime } from "./dictation/localApiRuntime";
import { checkProviderStatus } from "./dictation/providerStatus";
import { createRendererRecorderBridge } from "./dictation/rendererRecorderBridge";
import { createDictationSessionController } from "./dictation/sessionController";
import { getUserDataPath } from "./appPaths";
import { registerIpcHandlers } from "./ipc";
import { applyAppBehaviorSettings } from "./platform/appBehavior";
import { captureContext } from "./platform/context";
import { copyTextToClipboard, pasteTextWithClipboardFallback } from "./platform/insertion";
import {
  getPermissionStatus,
  requestAccessibilityPermission,
  requestMicrophonePermission
} from "./platform/permissions";
import { DEFAULT_DICTATION_SHORTCUT, createDictationShortcutController } from "./platform/shortcut";
import { openEchoDatabase } from "./storage/database";
import { createDictionaryRepository } from "./storage/dictionaryRepository";
import { createHistoryRepository } from "./storage/historyRepository";
import { createSettingsRepository } from "./storage/settingsRepository";
import { resolvePreloadPath, resolveRendererIndexPath } from "./windowPaths";

let hubWindow: BrowserWindow | undefined;
let overlayWindow: BrowserWindow | undefined;
let apiRuntime: LocalApiRuntime | undefined;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!hubWindow) {
      return;
    }
    if (hubWindow.isMinimized()) {
      hubWindow.restore();
    }
    hubWindow.focus();
  });

  app.whenReady().then(async () => {
    const runtime = await ensureLocalApiRuntime();
    apiRuntime = runtime;
    const windows = createWindows();
    hubWindow = windows.hubWindow;
    overlayWindow = windows.overlayWindow;

    const dbPath = getUserDataPath(app.getPath("userData"), "echo.sqlite");
    const db = openEchoDatabase(dbPath);
    const history = createHistoryRepository(db);
    const settings = createSettingsRepository(db);
    const dictionary = createDictionaryRepository(db);
    applyAppBehaviorSettings(settings.getSettings(), {
      getLoginItemSettings: () => app.getLoginItemSettings(),
      setLoginItemSettings: (options) => app.setLoginItemSettings(options),
      dock: app.dock
    });
    const recorder = createRendererRecorderBridge({
      webContents: hubWindow.webContents,
      ipcMain,
      recordingsDir: getUserDataPath(app.getPath("userData"), "recordings")
    });
    const overlay = overlayWindow;
    const controller = createDictationSessionController({
      createSessionId: randomUUID,
      now: () => new Date().toISOString(),
      getPermissionStatus,
      captureContext,
      recorder,
      backend: (input) => processDictation({ ...input, apiBaseUrl: runtime.apiBaseUrl }),
      insertText: pasteTextWithClipboardFallback,
      copyText: copyTextToClipboard,
      deleteLocalRecording: (localPath) => rm(localPath, { force: true }),
      overlay: {
        showRecording: ({ sessionId }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "recording", sessionId });
        },
        showFinalizing: ({ sessionId }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "finalizing", sessionId });
        },
        showProcessing: ({ sessionId }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "processing", sessionId });
        },
        showInserting: ({ sessionId }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "inserting", sessionId });
        },
        showCopied: ({ sessionId }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "copied", sessionId });
          setTimeout(() => overlay.hide(), 3000);
        },
        showError: ({ sessionId, code, message, recoverableText }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "error", sessionId, code, message, recoverableText });
        },
        showComplete: ({ sessionId }) => {
          overlay.webContents.send("echo:overlay-state", { status: "complete", sessionId });
          setTimeout(() => overlay.hide(), 1200);
        },
        hide: () => overlay.hide()
      },
      repositories: { history, settings, dictionary }
    });
    const dictationHandlers = {
      ...controller,
      getProviderStatus: () =>
        checkProviderStatus({
          apiBaseUrl: runtime.apiBaseUrl,
          ...(runtime.startupError ? { startupError: runtime.startupError } : {})
        })
    };

    const shortcutController = createDictationShortcutController({
      initialAccelerator: settings.getSettings().shortcut,
      onToggle: () => {
        hubWindow?.webContents.send("echo:shortcut-toggle");
      }
    });

    registerIpcHandlers({
      windows,
      repositories: { history, settings, dictionary },
      platform: {
        captureContext,
        insertText: pasteTextWithClipboardFallback,
        getPermissionStatus,
        requestMicrophonePermission,
        requestAccessibilityPermission,
        deleteLocalRecording: (localPath) => rm(localPath, { force: true })
      },
      dictation: dictationHandlers,
      onSettingsSaved: (nextSettings) => {
        const shortcutResult = shortcutController.replaceShortcut(nextSettings.shortcut || DEFAULT_DICTATION_SHORTCUT);
        if (!shortcutResult.registered) {
          hubWindow?.webContents.send("echo:shortcut-error", shortcutResult);
        }
        applyAppBehaviorSettings(nextSettings, {
          getLoginItemSettings: () => app.getLoginItemSettings(),
          setLoginItemSettings: (options) => app.setLoginItemSettings(options),
          dock: app.dock
        });
      }
    });

    const shortcutResult = shortcutController.registerInitial();

    if (!shortcutResult.registered) {
      hubWindow.webContents.once("did-finish-load", () => {
        hubWindow?.webContents.send("echo:shortcut-error", shortcutResult);
      });
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const recreated = createWindows();
        hubWindow = recreated.hubWindow;
        overlayWindow = recreated.overlayWindow;
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    apiRuntime?.stop();
    apiRuntime = undefined;
  });
}

function createWindows() {
  const preloadPath = resolvePreloadPath(__dirname);

  const hub = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 780,
    minHeight: 520,
    title: "Echo",
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const overlay = new BrowserWindow({
    width: 520,
    height: 112,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  hub.on("ready-to-show", () => hub.show());
  hub.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void hub.loadURL(process.env.ELECTRON_RENDERER_URL);
    void overlay.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/overlay`);
  } else {
    const rendererPath = resolveRendererIndexPath(__dirname);
    void hub.loadFile(rendererPath);
    void overlay.loadFile(rendererPath, { hash: "overlay" });
  }

  return { hubWindow: hub, overlayWindow: overlay };
}

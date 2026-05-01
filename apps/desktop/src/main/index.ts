import { randomUUID } from "node:crypto";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { processDictation } from "./dictation/backendClient";
import { createRendererRecorderBridge } from "./dictation/rendererRecorderBridge";
import { createDictationSessionController } from "./dictation/sessionController";
import { getUserDataPath } from "./appPaths";
import { registerIpcHandlers } from "./ipc";
import { captureContext } from "./platform/context";
import { pasteTextWithClipboardFallback } from "./platform/insertion";
import { registerDictationShortcut } from "./platform/shortcut";
import { openEchoDatabase } from "./storage/database";
import { createDictionaryRepository } from "./storage/dictionaryRepository";
import { createHistoryRepository } from "./storage/historyRepository";
import { createSettingsRepository } from "./storage/settingsRepository";

let hubWindow: BrowserWindow | undefined;
let overlayWindow: BrowserWindow | undefined;

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

  app.whenReady().then(() => {
    const windows = createWindows();
    hubWindow = windows.hubWindow;
    overlayWindow = windows.overlayWindow;

    const dbPath = getUserDataPath(app.getPath("userData"), "echo.sqlite");
    const db = openEchoDatabase(dbPath);
    const history = createHistoryRepository(db);
    const settings = createSettingsRepository(db);
    const dictionary = createDictionaryRepository(db);
    const recorder = createRendererRecorderBridge({ webContents: hubWindow.webContents, ipcMain });
    const overlay = overlayWindow;
    const controller = createDictationSessionController({
      createSessionId: randomUUID,
      now: () => new Date().toISOString(),
      captureContext,
      recorder,
      backend: (input) => processDictation({ ...input, apiBaseUrl: getApiBaseUrl() }),
      insertText: pasteTextWithClipboardFallback,
      overlay: {
        showRecording: ({ sessionId }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "recording", sessionId });
        },
        showProcessing: ({ sessionId }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "processing", sessionId });
        },
        showError: ({ sessionId, code, message }) => {
          overlay.showInactive();
          overlay.webContents.send("echo:overlay-state", { status: "error", sessionId, code, message });
        },
        showComplete: ({ sessionId }) => {
          overlay.webContents.send("echo:overlay-state", { status: "complete", sessionId });
          setTimeout(() => overlay.hide(), 1200);
        },
        hide: () => overlay.hide()
      },
      repositories: { history, settings, dictionary }
    });

    registerIpcHandlers({
      windows,
      repositories: { history, settings, dictionary },
      platform: {
        captureContext,
        insertText: pasteTextWithClipboardFallback
      },
      dictation: controller
    });

    const shortcut = settings.getSettings().shortcut;
    const shortcutResult = registerDictationShortcut({
      accelerator: shortcut,
      onToggle: () => {
        hubWindow?.webContents.send("echo:shortcut-toggle");
      }
    });

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
}

function getApiBaseUrl() {
  const explicit = process.env.API_BASE_URL;
  if (explicit) {
    return explicit;
  }

  const host = process.env.API_HOST ?? "127.0.0.1";
  const port = process.env.API_PORT ?? "43110";
  return `http://${host}:${port}`;
}

function createWindows() {
  const preloadPath = path.join(__dirname, "../preload/index.js");

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
    void hub.loadFile(path.join(__dirname, "../renderer/index.html"));
    void overlay.loadFile(path.join(__dirname, "../renderer/index.html"), { hash: "overlay" });
  }

  return { hubWindow: hub, overlayWindow: overlay };
}

export function formatShortcutError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Shortcut could not be registered.";
  }

  const value = payload as { code?: unknown; message?: unknown };
  if (value.code === "shortcut.conflict" && typeof value.message === "string") {
    return value.message;
  }

  return "Shortcut could not be registered.";
}

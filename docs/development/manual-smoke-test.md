# Echo Manual macOS Smoke Test

## Preconditions

- `.env` contains valid real provider credentials.
- Backend is running with `pnpm dev:api`.
- Desktop app is running with `pnpm dev:desktop`.
- Microphone permission is granted.
- Accessibility permission is granted for the terminal or app host running Electron.

## Test

- [ ] Open TextEdit and focus a blank document.
- [ ] Press the configured dictation shortcut once.
- [ ] Confirm the overlay shows recording state with elapsed time and controls.
- [ ] Say: "Let's meet tomorrow at seven, no actually make that three."
- [ ] Press the shortcut again.
- [ ] Confirm the overlay shows explicit processing text.
- [ ] Confirm TextEdit receives: "Let's meet tomorrow at three."
- [ ] Confirm History has a row with raw text, refined text, app name, provider metadata, and insertion status.
- [ ] Confirm no provider key appears in logs or UI.
- [ ] Run `git status --short` and confirm `.env` and local recordings are not staged.

## Expected Result

- Refined text is inserted into TextEdit, or copied to clipboard with a clear insertion fallback state.
- A History row is created locally.
- Provider metadata is visible without secrets.

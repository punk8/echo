# Echo Agent Guide

## Project Summary

Echo is a Typeless-like desktop dictation product. The first supported product surface is macOS dictation: the user focuses a writable field, toggles recording with a global shortcut, speaks naturally, and receives cleaned, formatted text inserted back into the active app.

The current implementation direction is:

- Electron desktop shell for shared UI, settings, history, and future Windows support.
- macOS-native helpers for shortcut capture, audio, Accessibility context, and text insertion.
- Cloud ASR plus LLM-based dictation refinement for punctuation, filler removal, self-correction handling, formatting, and clarity.
- Local history, recordings, settings, and dictionary data with explicit retention controls.

Primary references:

- `docs/requirements/mac-dictation-requirements.md`
- `docs/research/typeless-mac-ux-teardown.md`
- `docs/technical/electron-mac-dictation-technical-spec.md`

## Development Workflow

Before changing code or docs, inspect the relevant existing files and the current git status. The worktree may contain user changes; do not overwrite, revert, or clean up changes you did not make.

### Complexity Gate

For every task, first decide whether it is simple or complex.

Simple tasks can be handled directly when they are narrow, low-risk, and do not introduce a new product behavior, architecture decision, API contract, data model, or multi-file workflow.

Complex tasks must start with a written spec before implementation:

1. Create or update a Markdown spec under `spec/`. If the directory does not exist, create it.
2. Describe the problem, user flow, scope, non-goals, implementation approach, data/API contracts, error cases, and verification plan.
3. Develop against that spec so the reasoning trail is preserved.
4. Update the spec if implementation changes the agreed design.

Prefer a spec whenever the task affects dictation UX, native helpers, backend pipeline, LLM behavior, persistence, security/privacy, or cross-platform architecture.

### Subagent Workflow

If a task can be split into multiple independent, context-isolated subtasks, spawn multiple subagents and run them in parallel.

Use subagents only when the subtasks have clear ownership boundaries, such as separate docs, modules, adapters, tests, or research questions. Give each subagent a concrete output target and, for code changes, a disjoint file or module ownership area.

Do not terminate subagents early. Wait for them to finish, review their outputs, integrate the results, and verify the combined work before reporting completion.

Avoid subagents when the next step is blocked on one tightly coupled decision or when parallel work would create overlapping edits.

### Checkpoint Commits

When the completed work forms a meaningful checkpoint, commit and push it so future rollback is straightforward.

A checkpoint is usually appropriate when a spec, docs update, feature slice, bug fix, refactor step, or verified behavior change is complete on its own. Before committing, inspect the diff, run the relevant verification, and stage only files that belong to the current task.

Do not include unrelated user changes in the checkpoint commit. If the worktree contains unrelated edits, leave them unstaged and mention them when reporting status.

### Implementation Defaults

- Keep the current product scope focused on macOS dictation unless the task explicitly expands it.
- Preserve a future Windows path through shared Electron UI and platform adapters.
- Keep provider-specific ASR and LLM code behind replaceable interfaces.
- Do not hardcode API keys, secrets, provider tokens, or user data.
- Prefer local patterns and existing docs over inventing new architecture.
- Keep changes scoped to the requested behavior.

### Verification

Before claiming work is complete, run the checks that actually prove the claim. At minimum for documentation-only changes, inspect the diff and run `git diff --check`. For code changes, run the relevant tests, type checks, linting, or build commands available in the repo.

Report any verification that could not be run.

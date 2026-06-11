---
description: Validate the working tree with Depot CI and loop until green, narrating every command
---

Validate the current uncommitted changes against real CI using Depot CI, and
loop until green. This is a live demo: the audience must see every command.

## Presentation rules (non-negotiable)

- Before EVERY `depot ci` invocation, print the full command in a fenced
  ```bash block on its own, then run exactly that command.
- After starting a run, immediately surface the run ID and the
  `View in Depot:` URL on their own line so the audience can watch the UI.
- After each run completes, state in one short sentence: which job ran, the
  outcome, and (on failure) the one-line root cause from the logs.
- Keep all other narration to single sentences. No walls of text.

## Defaults

- Org: `3njzjqc81m` — pass `--org 3njzjqc81m` on every command.
- Repo: `boscloud-engine/false-flag-demo` (auto-detected from git remote).
- Workflow: `.depot/workflows/ci.yml` unless the change calls for another.

## The loop

1. Run `git status --short`. If the validation depends on newly created
   files, `git add` those files first so Depot's uploaded patch includes
   them. Do NOT commit.
2. Choose the smallest relevant validation loop:
   - Eval engine, SDK behavior, or `tests/eval-corpus/**` → `--job conformance`
   - Go-only backend changes → `--job test-go`
   - TypeScript-only changes → `--job test-js` or `--job build-js`
   - Codegen / lint / OpenAPI / typecheck → `.depot/workflows/lint.yml`
   - Change touching both runtimes' eval path → `.depot/workflows/agent-validate.yml`
3. Run it:
   ```bash
   depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job <job>
   ```
4. If it fails, inspect in this order — each as its own visible command:
   ```bash
   depot ci status <run-id> --org 3njzjqc81m
   depot ci diagnose --org 3njzjqc81m --run <run-id>
   depot ci logs <attempt-id> --org 3njzjqc81m
   ```
5. Fix the code locally, scoped to the failing check. Then rerun ONLY the
   job that failed (same command as step 3).
6. Repeat until green. Never push, and never substitute local-only checks
   for Depot CI — if Depot CI cannot start (auth/org/network), report the
   blocker explicitly and stop.

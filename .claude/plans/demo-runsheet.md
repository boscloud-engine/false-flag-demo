# Depot CI Demo — Run Sheet

Org `3njzjqc81m` · repo `boscloud-engine/false-flag-demo` · branch `main`

## Pre-flight (before you're on stage)

```bash
depot login
depot ci migrate preflight --org 3njzjqc81m
depot ci run --org 3njzjqc81m --workflow .depot/workflows/snapshot-e2e.yml   # refresh warm image
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job conformance   # warm cache
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job test-go       # warm cache
git switch main && git status --short   # clean tree
```

## Beat 0 — Cold open (~45s, talk only)

"Every CI today is push-wait-guess. You commit a hypothesis, push, wait 15–20 min, squint at logs. Death for an agent doing 30 iterations an hour."

Scroll the 16-job `.depot/workflows/ci.yml`.

## Beat 1 — The caching layer (~1 min, talk only)

Open `.depot/workflows/snapshot-e2e.yml` — "every heavy dep baked into one snapshot image, once." Then `.depot/workflows/lint.yml` → point at `runs-on: { image: <snapshot> }`.

## Beat 2 — Agent writes code (~1 min)

**Prompt:**

```
Add a `starts_with` string operator to the flag targeting engine in
internal/eval/predicates.go, wire it into the config, and add a corpus
fixture under tests/eval-corpus that uses it. Implement the Go side only
for now — do not touch the TypeScript cel-lite twin yet. Leave everything
uncommitted.
```

Say: "No commit. No push. Just my working tree."

## Beat 3 — Local-first validation, scoped (~2 min, centerpiece)

**Prompt (drives the whole loop):**

```
/fix-ci
```

Or run it by hand so each command is visible:

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job conformance
```

It fails (Go has the operator, TS twin doesn't). Inspect:

```bash
depot ci status <run-id> --org 3njzjqc81m
depot ci diagnose --org 3njzjqc81m --run <run-id>
depot ci logs <attempt-id> --org 3njzjqc81m
```

**Prompt to fix:**

```
The conformance job failed because the TypeScript cel-lite twin doesn't
implement starts_with yet. Add the matching implementation in the JS SDK
so both runtimes agree, then rerun only the conformance job.
```

Rerun only the failed job:

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job conformance
```

Green. "Reran *only* the job that mattered, in seconds, because the sandbox was warm."

## Beat 4 — Open the hood (~1 min, optional)

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job conformance --ssh-after-step 2
depot ci ssh <run-id> --org 3njzjqc81m
```

Inside: `pwd && ls`.

## Beat 5 — Dynamic workflow on the fly (~1–1.5 min)

Reveal `.depot/workflows/agent-validate.yml` (snapshot image, only Go tests + conformance):

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml
```

Green in seconds.

## Beat 6 — Push once, never red (~30s)

```bash
git add -A && git commit -m "feat(eval): add starts_with operator" && git push
```

Show the same workflow running green as a check on the PR.

## Beat 7 — The "why us" close (~45s, talk only)

API/CLI-driven, runs *uncommitted local diffs* → the only CI that fits inside an agent's inner loop. Same workflow local and in CI → zero drift. Everyone else is push-triggered and opaque.

## Fallback if a live run stalls

```bash
depot ci run list --org 3njzjqc81m
```

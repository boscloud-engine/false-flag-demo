# Demo Practice Runbook — "The Agent That Ships Green"

A copy-paste, step-by-step rehearsal guide for the PlatformCon webinar demo
(`.demo/PLATFORMCON-WEBINAR.md`). Work top to bottom. Every command is runnable
as written from the repo root.

- **Depot org:** `3njzjqc81m` (DepotSolutions-AD) — self-serve, no CEO-org access.
- **GitHub repo:** `boscloud-engine/false-flag-demo` (fork).
- **CI runs remotely**; only the app beats run locally (Docker).

---

## Phase 0 — One-time setup (do once, ~30 min)

```bash
# Local toolchain for the app beats (CI runs remotely)
brew install go hurl
# + install Docker Desktop or OrbStack and make sure it's running

# Depot CLI (if not already installed)
brew install depot/tap/depot
depot login

# Accept the Depot Code Access app permissions for the GitHub org (one click, org admin)
open "https://github.com/organizations/boscloud-engine/settings/installations/115237591"

cd ~/LocalDev/false-flag-demo

# Verify Depot CI can see the repo
depot ci migrate preflight --org 3njzjqc81m

# JS deps for the agent's TypeScript-side fix
pnpm --dir js install
```

Checkpoint: `depot ci migrate preflight --org 3njzjqc81m` should pass.

---

## Phase 1 — Reset to a clean slate (before every rehearsal)

```bash
cd ~/LocalDev/false-flag-demo

# Throw away any leftover edits from the previous run-through
git checkout main && git checkout . && git clean -fd internal js tests
git status --short        # should be empty (agent-validate.yml stays untracked — that's intentional)
```

> Note: `.depot/workflows/agent-validate.yml` is intentionally **untracked** so it
> reads as "the agent wrote this on the fly." `git clean -fd` is scoped to
> `internal js tests`, so it won't delete it. Don't `git clean` the `.depot` dir.

---

## Phase 2 — Boot the real app and seed it

```bash
docker compose up -d --build
make seed
open http://localhost:3030        # the Remix dashboard
```

If the DB has leftovers from a prior rehearsal, reset to pristine seed state:

```bash
docker compose exec -T db psql -U falseflag -d falseflag \
  -c "TRUNCATE TABLE audit_events, snapshots, segments, environments, flag_versions, flags, projects RESTART IDENTITY CASCADE"
make seed
```

Checkpoint: dashboard loads at http://localhost:3030, you can click a project → a flag.

---

## Phase 3 — Warm the Depot cache (so on-stage runs are seconds, not minutes)

```bash
# Warms the centerpiece job + the fan-out beat's jobs
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml \
  --job conformance --job test-go --job test-go-race --job test-js \
  --job build-js --job contract-test

# (optional) warm the lint loop on the snapshot image — beat 2.6
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml

# (optional) warm the dynamic workflow — beat 2.7
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml

# Re-clean if the warm run left anything behind
git status --short
```

Keep a tab on `depot ci run list` to show prior green runs if a live run is slow.

---

## Phase 4 — Rehearse the run of show

### Beat 0 — Open in the product (~45s)
Share the browser at http://localhost:3030. Click a project → a flag → show the source.

```bash
ls .depot/workflows        # show the CI gravity: real multi-job pipeline
```

### Beat 1 — The problem, in one breath (~30s)
Talk only. "Agents made writing code cheap; validating it is the bottleneck.
Old loop: push → wait → copy logs back → push again. New loop: agent runs real
CI on its *uncommitted* change, reads the result, fixes, reruns, pushes once green."

### Beat 2 — One prompt, real CI, deterministic failure (~3 min) — CENTERPIECE

Optional 10-second cold open — prove the operator doesn't exist yet:

```bash
curl -s -X PUT localhost:8080/v1/projects/acme-web/flags/_probe \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"json","source":{"value_type":"boolean","default":false,"rules":[
        {"id":"r1","when":{"kind":"starts_with","attr":"user.email","value":"beta-"},"value":true}]}}'
# expect: {"message":"rule \"r1\": invalid predicate: unknown kind \"starts_with\""}
```

Paste into the coding agent (Codex / Cursor / Claude Code):

```text
Add a new `starts_with` string predicate to the FalseFlag targeting engine.
Focus only on the Go implementation for now and only address other runtimes if
Depot CI proves they fail.

Make sure you add a shared fixture under `tests/eval-corpus/**`.

When you are ready to validate, follow /fix-ci.
```

What should happen (narrate while it runs):
1. Agent edits `internal/eval/predicates.go` + config wiring + a corpus fixture. **No commit, no push.**
2. Agent runs `depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job conformance`.
   Depot uploads the uncommitted diff as a patch and runs the real workflow remotely.
3. **It fails on purpose** — Go knows `starts_with`, the TypeScript SDK twin doesn't; the
   conformance corpus asserts byte-identical decisions across both runtimes.
4. Agent reads the failure (`depot ci status` / `depot ci diagnose` / `depot ci logs --job conformance`),
   adds the TypeScript implementation, and reruns **only** `conformance`. Green.

Commands to narrate if you want to drive it manually:

```bash
depot ci status <run-id>
depot ci diagnose --org 3njzjqc81m --run <run-id>
depot ci logs <run-id> --job conformance
```

### Beat 2.5 — Fan out the wider gate (~45s)

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml \
  --job conformance --job test-go --job test-go-race --job test-js \
  --job build-js --job contract-test
```

Open the printed run URL — 8 jobs light up concurrently (test-go-race and
contract-test each expand to postgres + sqlite). Talk track: "27 parallel jobs
after matrix expansion; the agent chooses how much of it any change deserves."

### Beat 2.6 (optional) — The caching layer, visibly (~30s)

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml
```

Show the `runs-on` in [.depot/workflows/lint.yml](../.depot/workflows/lint.yml): a 4x16 runner
booting from a pre-baked snapshot image (Go, Node, pnpm, Playwright+Chromium, Spectral, Postgres inside).

### Beat 2.7 (optional) — Dynamic workflow, agent writes its own loop (~1 min)

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml
```

Reveal [.depot/workflows/agent-validate.yml](../.depot/workflows/agent-validate.yml) — it's untracked, so it reads
as freshly agent-generated: only the two checks an eval-engine change can break.

### Beat 3 — The wow: feature goes live in the app (~1.5 min)

CI is green but nothing is pushed. Ship the working tree into the running product:

```bash
docker compose up -d --build api proxy
```

Create a project + flag that uses the brand-new operator:

```bash
curl -s -X POST localhost:8080/v1/projects -H 'Content-Type: application/json' \
  -d '{"slug":"webinar","display_name":"Webinar","config_strategy":"json"}'

curl -s -X POST localhost:8080/v1/projects/webinar/flags -H 'Content-Type: application/json' \
  -d '{"key":"new-onboarding","name":"New Onboarding","value_type":"boolean","default_value":false}'

curl -s -X PUT localhost:8080/v1/projects/webinar/flags/new-onboarding -H 'Content-Type: application/json' \
  -d '{"strategy":"json","source":{"value_type":"boolean","default":false,"rules":[
        {"id":"r1","when":{"kind":"starts_with","attr":"user.email","value":"beta-"},"value":true}]}}'
```

Evaluate two users live:

```bash
# beta user -> true, rule_matched
curl -s -X POST localhost:8080/v1/projects/webinar/flags/new-onboarding/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"context":{"user":{"email":"beta-ada@example.com"}}}'

# regular user -> false, default
curl -s -X POST localhost:8080/v1/projects/webinar/flags/new-onboarding/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"context":{"user":{"email":"carol@example.com"}}}'
```

Flip to the dashboard tab — the `webinar` project + flag are right there.

### Beat 4 — Push once, never red (~30s)

```bash
git add -A && git commit -m "feat(eval): add starts_with predicate" && git push origin main
```

> ⚠️ During **practice**, do NOT push to `main`. Either skip this beat, or commit to a throwaway
> branch and discard it: `git switch -c rehearsal-throwaway && git add -A && git commit -m wip`
> then `git switch main && git branch -D rehearsal-throwaway`.

### Beat 5 — Close (~30s)
Talk only. "The winning CI isn't the one with the fastest runners — it's the one
agents can call as infrastructure: API-driven, cache-backed, runs your uncommitted
diff, observable, cheap enough to call constantly."

---

## Phase 5 — Tear down after a rehearsal

```bash
git checkout main && git checkout . && git clean -fd internal js tests
docker compose down            # add -v to also wipe the DB volume
```

---

## Rehearsal checklist

- [ ] `depot ci migrate preflight --org 3njzjqc81m` passes.
- [ ] The agent prompt produces the Go-only change AND the conformance failure on the first run.
- [ ] `docker compose up -d --build api proxy` picks up the working tree.
- [ ] The full create → publish → evaluate sequence returns `rule_matched` / `default` as scripted.
- [ ] Warm `conformance` run completes inside your target time window.
- [ ] Screen-record at least one full clean run-through as the hard fallback.

## Gotchas

- **Don't `git clean` `.depot/`** — it would delete the intentionally-untracked `agent-validate.yml`.
- **Container builds / image-scan / Playwright shards won't run** in this org — `depot.json` id
  (`mr31tm4wc4`) is the CEO's container-build project. The demo honestly fans out 8 jobs live and
  *talks about* the 27-job expansion. To unlock the rest, create a container-build project in
  `3njzjqc81m` and swap the id in `depot.json`.
- If a live run is slow, switch to the `depot ci run list` tab and show a prior green run.

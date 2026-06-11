# PlatformCon Webinar Demo — "The Agent That Ships Green"

A ~6 minute webinar cut of the Depot CI Demo (`.demo/DEMO.md`), simplified for
a broad audience and re-staged to end **inside the running product**, not just
a green CI run. One agent prompt, one deterministic failure, one fix, and the
feature live in a real app.

Runs entirely self-serve: Depot org `3njzjqc81m` (DepotSolutions-AD), GitHub
repo `boscloud-engine/false-flag-demo` (org fork). No custom snapshot image
required — the only job used is `conformance`, which runs on
`depot-ubuntu-latest`.

## Prep (do before the webinar, ~30 min once)

One-time setup:

```bash
# 1. Local toolchain for the app beats (CI itself runs remotely)
brew install go hurl
# plus Docker Desktop or OrbStack

# 2. The Depot Code Access app is already installed for boscloud-engine.
#    Accept its pending permissions update (org admin, one click):
open "https://github.com/organizations/boscloud-engine/settings/installations/115237591"

# 3. Verify
cd ~/LocalDev/false-flag-demo
depot ci migrate preflight --org 3njzjqc81m

# 4. JS deps for the agent's TS-side fix
pnpm --dir js install
```

Right before going live:

```bash
cd ~/LocalDev/false-flag-demo
git checkout main && git checkout . && git clean -fd internal js tests

# boot the real app and seed it
docker compose up -d --build
make seed
open http://localhost:3030

# if the DB has leftovers from rehearsal, reset to pristine seed state:
docker compose exec -T db psql -U falseflag -d falseflag \
  -c "TRUNCATE TABLE audit_events, snapshots, segments, environments, flag_versions, flags, projects RESTART IDENTITY CASCADE"
make seed

# warm the Depot cache so the on-stage runs are seconds
# (warms conformance AND the fan-out beat's jobs)
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml \
  --job conformance --job test-go --job test-go-race --job test-js \
  --job build-js --job contract-test

# warm the lint loop on the snapshot image (optional beat 2.6)
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml

# warm the dynamic workflow (optional beat 2.7)
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml

# reset to a clean tree again after the warm run if it left anything behind
git status --short
```

Rehearse the full run-of-show at least once and **screen-record it** as the
hard fallback. Keep `depot ci run list` open in a tab to show prior green runs
if a live run is slow.

## Run of show

### 0. Open in the product, not the pitch (~45s)

Share the browser at `http://localhost:3030`. Click into a project, click a
flag, show the rendered source.

> "This is FalseFlag — a feature flag platform: Go API, TypeScript SDK,
> Kubernetes operator, MCP server, Remix dashboard, Postgres and SQLite
> backends. It's backed by a 16-job CI pipeline: lint, two test matrices,
> cross-runtime conformance, image builds and scans, Playwright sharded six
> ways. A real app with real CI gravity."

```bash
ls .depot/workflows
```

### 1. The problem, in one breath (~30s)

> "Agents made writing code cheap — and made validating it the bottleneck.
> The old loop is: push, wait for CI, copy logs back to the agent, push
> again. The new loop is: the agent runs real CI against its *uncommitted*
> local change, reads the result, fixes, reruns, and only pushes once it's
> already green."

### 2. One prompt, real CI, deterministic failure (~3 min) — centerpiece

Optional 10-second cold open for this beat — prove the operator doesn't
exist yet (verified: returns `unknown kind "starts_with"`):

```bash
curl -s -X PUT localhost:8080/v1/projects/acme-web/flags/_probe \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"json","source":{"value_type":"boolean","default":false,"rules":[
        {"id":"r1","when":{"kind":"starts_with","attr":"user.email","value":"beta-"},"value":true}]}}'
# -> {"message":"rule \"r1\": invalid predicate: unknown kind \"starts_with\""}
```

Paste into the coding agent:

```text
Add a new `starts_with` string predicate to the FalseFlag targeting engine.
Focus only on the Go implementation for now and only address other runtimes if
Depot CI proves they fail.

Make sure you add a shared fixture under `tests/eval-corpus/**`.

When you are ready to validate, follow /fix-ci.
```

`/fix-ci` (in `.claude/commands/` and `.cursor/commands/`) is the
audience-visualization harness: it makes the agent print every `depot ci`
command in a fenced block before running it, surface each run's
`View in Depot` URL (keep that tab visible), and give a one-line verdict per
run. The loop logic (smallest relevant job, status → diagnose → logs on
failure, rerun only what failed) is encoded there and in `AGENTS.md`.

What happens (narrate while it runs):

1. The agent edits `internal/eval/predicates.go` + config wiring + a corpus
   fixture. **No commit, no push** — just the working tree.
2. It runs `depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml
   --job conformance`. Depot uploads the uncommitted diff as a patch and runs
   the real workflow remotely. *"No other CI on the market runs your
   uncommitted diff."*
3. **It fails — on purpose.** Go knows `starts_with`; the TypeScript SDK twin
   doesn't. The conformance corpus asserts byte-identical decisions across
   both runtimes, so this is a genuine cross-runtime mismatch, not a staged
   `exit 1`.
4. The agent reads the failure programmatically (`depot ci status`,
   `depot ci diagnose`, `depot ci logs --job conformance`), adds the
   TypeScript implementation, and reruns **only** `conformance`. Green.

> "That's the intelligence beat: it didn't re-run the world, it re-ran the
> one job its change touches — and the loop took seconds because Depot Cache
> kept the sandbox warm."

### 2.5 Fan out the wider gate (~45s) — the CI-gravity flex

The agent validated with one targeted job. Before pushing, fan out the
broader pipeline against the same uncommitted diff — eight jobs in parallel,
including both database-backend matrices:

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml \
  --job conformance --job test-go --job test-go-race --job test-js \
  --job build-js --job contract-test
```

Open the run URL it prints — the Depot UI shows all eight lighting up
concurrently (test-go-race and contract-test each expand to a
postgres + sqlite matrix).

> "Same uncommitted diff, now against the wider gate: unit tests in both
> languages, race detection and REST↔RPC contract tests against real
> Postgres and SQLite. The full pipeline is 27 parallel jobs after matrix
> expansion — the agent chooses how much of it any change deserves."

### 2.6 (Optional) The caching layer, visibly (~30s)

Show [.depot/workflows/lint.yml](../.depot/workflows/lint.yml) `runs-on`:
a 4x16 runner booting from a pre-baked snapshot image
(`3njzjqc81m.registry.depot.dev/falseflag-ci-base:...`) with Go, Node, pnpm,
Playwright + Chromium, Spectral, and the Postgres image already inside.

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml
```

> "No `apt-get`, no `pnpm install` from cold. The sandbox was baked once and
> every loop starts warm — that's why the agent can afford to call CI like a
> function."

### 2.7 (Optional) Dynamic workflow — the agent writes its own loop (~1 min)

Reveal [.depot/workflows/agent-validate.yml](../.depot/workflows/agent-validate.yml)
— intentionally **uncommitted**, so it reads as freshly agent-generated. It's
a bespoke validation loop in plain GitHub Actions YAML: only the two checks
an eval-engine change can break (Go unit tests + cross-runtime conformance),
running in parallel on the warm snapshot image.

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml
```

> "The repo doesn't have to anticipate every validation loop. The agent can
> author one on the fly, in a language it already speaks, and Depot CI will
> execute it against the local diff — that's a dynamic workflow."

### 3. The wow: the feature goes live in the app (~1.5 min)

CI is green but nothing is pushed yet. Ship the working tree into the running
product and use the brand-new operator:

```bash
docker compose up -d --build api proxy
```

Create a flag that targets beta users by email prefix — using the operator
that did not exist five minutes ago:

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

Flip to the dashboard tab — the `webinar` project and flag are right there in
the UI.

> "Agent wrote it, real CI validated it against both runtimes, and it's
> serving decisions in the product — and we still haven't pushed a commit."

### 4. Push once, never red (~30s)

```bash
git add -A && git commit -m "feat(eval): add starts_with predicate" && git push origin main
```

> "One push, already green. The agent never pushed a broken commit."

### 5. Close (~30s)

> "As agents write more of the code, the bottleneck moves from writing to
> validating. The winning CI isn't the one with the fastest runners — it's
> the one agents can call as infrastructure: API-driven, cache-backed, runs
> your uncommitted diff, observable, and cheap enough to call constantly.
> That's what Depot CI is."

## Rehearsal checklist (verify once before the webinar)

- [ ] `depot ci migrate preflight --org 3njzjqc81m` passes against the fork.
- [ ] The agent prompt produces the Go-only change and the conformance
      failure on the first run (it should — the corpus asserts both runtimes).
- [x] Predicate-kind validation: RESOLVED. Publish validates kinds
      (`internal/config/json.go` `validatePredicate`), but the conformance
      corpus compiles through the same path — so the agent cannot get CI
      green without wiring it. CI green ⇒ the beat-3 publish works.
      (Verified live: `starts_with` publish today returns
      `unknown kind "starts_with"`; the full create→publish→evaluate
      sequence works with existing kinds — `rule_matched`/`default` exactly
      as scripted.)
- [ ] `docker compose up -d --build api proxy` picks up the working tree
      (images build from local source).
- [ ] Timing: warm conformance run completes in your target window.
- [x] `agent-validate.yml` verified green (run zn49z9ptfh): 2,588 Go unit
      tests + 28 Go conformance fixtures + 149 TS tests, in parallel on the
      snapshot image. Works while untracked — `depot ci run` reads the
      workflow from disk, which IS the "agent wrote it on the fly" story.

## Job inventory (what's runnable in org 3njzjqc81m)

`ci.yml` defines 11 jobs → 27 parallel jobs after matrix expansion.

| Job | Expanded | Runnable here? |
|---|---|---|
| conformance, test-go, test-js, build-js | 4 | ✅ verified (run 65qkj806jd) |
| test-go-race, contract-test | 2×2 = 4 | ✅ plain runners + service containers |
| lint (snapshot image) | 1 | ✅ once snapshot bake lands (run vjd47375cw) |
| build-images → image-scan, smoke | 1+3+2 = 6 | ❌ needs a Depot container-build project in this org (depot.json `mr31tm4wc4` is the CEO's) |
| dashboard-e2e (2 backends × 6 shards) | 12 | ❌ needs build-images AND the snapshot image |

So the demo can honestly fan out **8 jobs live** (beat 2.5) plus the lint
snapshot beat (2.6), while *talking about* the 27-job expansion. To unlock
the remaining 18 (images, scans, smoke, sharded Playwright), create a
container-build project in org 3njzjqc81m and replace the id in `depot.json`.

## Differences from the Depot CI Demo (`.demo/DEMO.md`)

- Restored: the snapshot-image beat — the image is rebaked into
  `3njzjqc81m.registry.depot.dev` via `snapshot-e2e.yml` (registry host
  committed in 3213e86). The original was pinned to the CEO's org registry
  (`d58mfwccbf.registry.depot.dev`). If it ever needs rebaking, just
  dispatch `snapshot-e2e.yml` again — the registry hosts in
  `snapshot-e2e.yml`/`lint.yml`/`ci.yml` already point at this org.
- Dropped: SSH-into-the-runner beat and the investor/Series-B framing.
- Added: beat 3 — the feature served live from the real app via
  `/v1/projects/<slug>/flags/<key>/evaluate`, which is the webinar wow.
- Org/repo: `3njzjqc81m` + `boscloud-engine/false-flag-demo` fork (self-serve;
  no access to the CEO's org required). `AGENTS.md` in this clone already
  points the agent at these defaults.

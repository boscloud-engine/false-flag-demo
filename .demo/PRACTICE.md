# Demo Practice Runbook — "The Agent That Ships Green"

A copy-paste, step-by-step rehearsal guide for the PlatformCon webinar demo
(`.demo/PLATFORMCON-WEBINAR.md`). Work top to bottom. Every command is runnable
as written from the repo root.

- **Depot org:** `3njzjqc81m` (DepotSolutions-AD) — self-serve, no CEO-org access.
- **GitHub repo:** `boscloud-engine/false-flag-demo` (fork).
- **CI runs remotely**; only the app beats run locally (Docker).

**Length:** this is the **20–25 minute** cut. It keeps the agentic-loop
centerpiece (beat 2) and adds three "pre-built images" showcase beats that were
optional in the short cut:

- **Beat 2.6** — the pre-built CI base image (`snapshot-e2e.yml` → warm `lint`).
- **Beat 2.7** — `depot bake`: app images on Depot's remote BuildKit + the Depot
  Registry hand-off to `image-scan` / `smoke`.
- **Beat 2.8** — the agent-authored dynamic workflow.

For the ~6 minute cut, skip 2.6–2.8 and the bake variants — see
`.demo/PLATFORMCON-WEBINAR.md`.

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

### One-time: bake the CI base snapshot image (for beat 2.6)

`lint` and `dashboard-e2e` boot **from** a pre-baked snapshot image — Go, Node,
pnpm, Playwright + Chromium, Spectral, and the Postgres image already inside.
That image lives in this org's registry
(`3njzjqc81m.registry.depot.dev/falseflag-ci-base:...`). It's normally **already
baked** — you only redo this if it's missing or you bumped a tool version. The
bake runs remotely and takes up to ~30 min:

```bash
# Dispatch the snapshot builder (depot/snapshot-action) — pushes the warm
# sandbox image to 3njzjqc81m.registry.depot.dev. One-time / rare.
depot ci run --org 3njzjqc81m --workflow .depot/workflows/snapshot-e2e.yml
```

Confirm beat 2.6 can use it by running `lint` once (it pulls the image):

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml
```

> The `SNAPSHOT_IMAGE` ref is committed in
> [.depot/workflows/snapshot-e2e.yml](../.depot/workflows/snapshot-e2e.yml) and
> consumed by the `runs-on.image` of `lint` and `dashboard-e2e`. Re-dispatching
> `snapshot-e2e.yml` is all it takes to rebake.

Checkpoint: `depot ci migrate preflight --org 3njzjqc81m` should pass, and the
`lint` run above should go green on the snapshot image.

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

### Variant: build the images on Depot instead of locally

The compose service images and the [docker-bake.hcl](../docker-bake.hcl) targets share the
**same tags** (`ghcr.io/depot/falseflag/<svc>:dev`), so you can build them on
Depot's remote BuildKit, load them into the local Docker engine, then bring the
stack up **without** `--build`:

```bash
# Build all 5 service images on Depot, load into local Docker.
# --load can't be multi-arch, so pin to this machine's arch
# (Apple Silicon = arm64; Intel = amd64). bake defaults to amd64+arm64.
depot bake --load --set "*.platform=linux/arm64" \
  api proxy operator mcp dashboard

# Up WITHOUT --build — compose uses the freshly loaded :dev images
docker compose up -d
make seed
open http://localhost:3030
```

> **Build project:** `depot bake` builds against the project id in
> [depot.json](../depot.json) — now `lgvdzr8ffq` (`falseflag-ci`, in org
> `3njzjqc81m`, self-serve). Verified working (build `5w604ftsxg`). `--load`
> round-trips the built image back over the network, so the win is biggest with a
> warm cache / slow laptop.

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
# Warms the centerpiece job + the fan-out beat's jobs (beats 2 & 2.5)
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml \
  --job conformance --job test-go --job test-go-race --job test-js \
  --job build-js --job contract-test

# Warm the lint loop on the snapshot image — beat 2.6
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml

# Warm the dynamic workflow — beat 2.8
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml

# Re-clean if a warm run left anything behind
git status --short
```

Warm the `depot bake` path for beat 2.7 (pulls the BuildKit cache warm so the
on-stage bake is seconds). Requires a reachable container-build project — see
the caveat in beat 2.7:

```bash
# Builds the 5 service images on Depot remote BuildKit (no --load needed to warm cache)
depot bake api proxy operator mcp dashboard
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

Optional 10-second cold open — prove the operator doesn't exist yet. Target an
**existing** seeded flag (`acme-web/checkout-redesign`); a rejected publish does
not mutate it, so this is safe to run live:

```bash
curl -s -X PUT localhost:8080/v1/projects/acme-web/flags/checkout-redesign \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"json","source":{"value_type":"boolean","default":false,"rules":[
        {"id":"r1","when":{"kind":"starts_with","attr":"user.email","value":"beta-"},"value":true}]}}'
# expect: {"message":"rule \"r1\": invalid predicate: unknown kind \"starts_with\""}
# (a non-existent flag like _probe returns "store: not found" instead — use a real one)
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

> **Pre-built images — the next three beats.** The loop above was fast because
> nothing started cold. Beats 2.6–2.8 make the substrate behind that visible:
> a pre-baked CI sandbox image, app images built on Depot and handed between
> jobs via the registry, and an agent-authored workflow that reuses all of it.

### Beat 2.6 — The pre-built CI base image (~2 min)

The lint loop doesn't `apt-get` or `pnpm install` from cold — its runner **boots
from a snapshot image** baked once by [snapshot-e2e.yml](../.depot/workflows/snapshot-e2e.yml).

First, show what's baked in — open [snapshot-e2e.yml](../.depot/workflows/snapshot-e2e.yml)
and point at the `depot/snapshot-action` step and the `SNAPSHOT_IMAGE` it pushes:

```bash
sed -n '1,54p' .depot/workflows/snapshot-e2e.yml
```

> "We bake the expensive setup **once** — Go, Node, pnpm, Playwright + Chromium,
> Spectral, the Postgres image — and snapshot the whole sandbox into this org's
> registry. Every loop after that starts warm."

Then show a runner consuming it — the `runs-on.image` in
[lint.yml](../.depot/workflows/lint.yml) (a 4x16 runner), and run it live:

```bash
sed -n '15,40p' .depot/workflows/lint.yml      # runs-on: size 4x16 + image: ...falseflag-ci-base:...
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml
```

Open the run URL — the runner is ready in seconds and goes straight into
`go mod download` / `pnpm install` (already cached), then the parallel lint
fan-out. No cold toolchain install on screen.

> "No `apt-get`, no cold `pnpm install`. That's why the agent can afford to call
> CI like a function — the sandbox was built once and every loop reuses it."

### Beat 2.7 — `depot bake`: build app images on Depot + registry hand-off (~3 min)

The app's five service images are built on Depot's remote BuildKit and reused —
both locally and across CI jobs. Show the bake file, then build:

```bash
sed -n '1,30p' docker-bake.hcl                 # one target per service, shared base
depot bake api proxy operator mcp dashboard    # remote BuildKit, parallel, cached
```

> "One `depot bake`, five images, built in parallel on remote BuildKit with a
> shared cache — not five cold `docker build`s on a laptop."

Then show how CI reuses the **same** bake, with the Depot Registry as the
hand-off between jobs — open [build.yml](../.depot/workflows/build.yml) and
[ci.yml](../.depot/workflows/ci.yml):

```bash
sed -n '100,121p' .depot/workflows/build.yml   # depot/bake-action: save: true, save-tag, build-id output
sed -n '216,272p' .depot/workflows/ci.yml      # image-scan & smoke pull via depot/pull-action + build-id
```

> "In CI the `build-images` job bakes once and **saves** the result to the Depot
> Registry with a build-id. Downstream `image-scan` and `smoke` don't rebuild —
> they `depot/pull-action` the exact images by build-id. Built once, scanned and
> smoke-tested everywhere. That's the registry as a fast artifact bus between
> jobs."

> ✅ **Local bake runs self-serve** (this is the on-stage beat). `depot bake`
> builds against [depot.json](../depot.json) id `lgvdzr8ffq` (`falseflag-ci`, org
> `3njzjqc81m`), authenticated by your own `depot login` — verified live (build
> `5w604ftsxg`, all 5 services, both archs).
>
> ⚠️ **The CI `build-images` job is NOT runnable yet.** A trial run failed with
> `permission_denied: Invalid token` (run `48zbhl41x6`): the new project has no
> **OIDC trust relationship** for `boscloud-engine/false-flag-demo`, so the
> `depot/bake-action` can't authenticate. Fix is dashboard-only — add a trust
> relationship (or a project token wired as `DEPOT_TOKEN`) at
> https://depot.dev/orgs/3njzjqc81m/projects/lgvdzr8ffq/settings . Until then,
> keep beat 2.7 to the **local** bake + walking the `build.yml` / `ci.yml` YAML.

To build the images on Depot **and run the local stack from them** (replaces the
`--build` in Phase 2), add `--load` and pin your arch:

```bash
depot bake --load --set "*.platform=linux/arm64" api proxy operator mcp dashboard
docker compose up -d            # uses the freshly loaded :dev images, no local build
```

### Beat 2.8 — Dynamic workflow, agent writes its own loop (~1.5 min)

```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml
```

Reveal [.depot/workflows/agent-validate.yml](../.depot/workflows/agent-validate.yml) — it's untracked, so it reads
as freshly agent-generated: only the two checks an eval-engine change can break,
running in parallel **on the same warm snapshot image** from beat 2.6.

> "The repo doesn't have to anticipate every validation loop. The agent can
> author one on the fly, in plain Actions YAML, and Depot runs it against the
> uncommitted diff — reusing the same pre-built sandbox and cache as everything
> else."

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

## Run-of-show timing (≈20–25 min)

| Beat | What | ~Time |
|---|---|---|
| 0 | Open in the product | 0:45 |
| 1 | The problem | 0:30 |
| 2 | Agent loop, real CI, deterministic failure (centerpiece) | 3:00 |
| 2.5 | Fan out the wider gate (8 jobs) | 0:45 |
| 2.6 | Pre-built CI base image (snapshot-e2e → warm lint) | 2:00 |
| 2.7 | `depot bake` + Depot Registry hand-off | 3:00 |
| 2.8 | Agent-authored dynamic workflow | 1:30 |
| 3 | Feature goes live in the app | 1:30 |
| 4 | Push once, never red | 0:30 |
| 5 | Close | 0:30 |

Plus narration/Q&A slack → 20–25 min. Drop 2.6–2.8 for the ~6 min cut.

## Rehearsal checklist

- [ ] `depot ci migrate preflight --org 3njzjqc81m` passes.
- [ ] The agent prompt produces the Go-only change AND the conformance failure on the first run.
- [ ] `docker compose up -d --build api proxy` picks up the working tree.
- [ ] The full create → publish → evaluate sequence returns `rule_matched` / `default` as scripted.
- [ ] Warm `conformance` run completes inside your target time window.
- [ ] **Beat 2.6:** the snapshot image exists — `lint` goes green and boots warm (no cold toolchain install on screen).
- [x] **Beat 2.7:** `depot bake` runs self-serve against project `lgvdzr8ffq` (verified, build `5w604ftsxg`).
- [ ] **Beat 2.8:** `agent-validate.yml` is present but **untracked** (don't let a `git clean` eat it).
- [ ] Screen-record at least one full clean run-through as the hard fallback.

## Gotchas

- **Don't `git clean` `.depot/`** — it would delete the intentionally-untracked `agent-validate.yml`.
- **Everything now runs in `3njzjqc81m`.** The **snapshot** image (beat 2.6) lives
  in `3njzjqc81m.registry.depot.dev`; the **app-image bake** (beat 2.7) builds
  against the org's own project `lgvdzr8ffq` (`falseflag-ci`). No CEO-org access
  anywhere in the demo.
- **Image pipeline points at `lgvdzr8ffq`** — `depot.json` and the
  [ci.yml:240](../.depot/workflows/ci.yml) registry ref both use it. Local
  `depot bake` works; the **CI `build-images` job still fails auth** until the
  project gets an OIDC trust relationship (or a `DEPOT_TOKEN`) — dashboard-only,
  see beat 2.7. Don't run `--job build-images` live until that's done.
- **Playwright shards (`dashboard-e2e`) still won't run** live — they need the CI
  `build-images` job wired end-to-end plus the snapshot image. The demo honestly
  fans out 8 jobs live (beat 2.5) and *talks about* the 27-job expansion.
- **`depot bake --load` is single-arch** — pin `--set "*.platform=linux/<arch>"`
  (arm64 on Apple Silicon, amd64 on Intel) or the load fails.
- If a live run is slow, switch to the `depot ci run list` tab and show a prior green run.

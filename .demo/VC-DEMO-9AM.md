# VC Demo — 9am (simple runsheet)

- **THE STORY:** Agents write code in seconds; normal CI takes minutes. Depot CI runs the agent's *uncommitted* code in seconds — it fixes itself, and you push only when it's already green.
- **KEY TRICK:** the Go code is already in the working tree before you start. Live, the agent only writes the small TypeScript half — that's the real fail → fix → green moment.

**Facts to have ready:**
- Depot org: `3njzjqc81m`  •  Repo: `boscloud-engine/false-flag-demo`
- Container builds: project `lgvdzr8ffq`  •  registry `registry.depot.dev/lgvdzr8ffq`
- App: dashboard `http://localhost:3030`, API `http://localhost:8080`
- CI runs remotely on Depot. Nothing gets pushed until the very end.

---

## Before you go live

Run these top to bottom. (Full one-time setup lives in [DEMO.md](DEMO.md) — this is just the day-of.)

**1. Warm the caches so on-stage runs take seconds:**
```bash
cd ~/LocalDev/false-flag-demo
git checkout main && git checkout . && git clean -fd internal js tests

depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml \
  --job conformance --job test-go --job test-go-race --job test-js \
  --job build-js --job contract-test

depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml

# (optional, only if demoing Beat 3.6's bake) refresh the runner snapshot now so the
# live run can open a finished bake instead of waiting on a cold one — it takes minutes.
depot ci run --org 3njzjqc81m --workflow .depot/workflows/snapshot-e2e.yml

# Warm the container-build cache so the on-stage `depot bake` (Beat 3.8) comes back cached.
depot bake -f docker-bake.hcl --save --save-tag demo
```

**2. Boot the app and seed it:**
```bash
docker compose up -d --build
make seed
open http://localhost:3030
```

**3. Pre-stage the Go change — do this LAST, right before you go on:**
```bash
git checkout main && git checkout . && git clean -fd internal js tests

git checkout 24f21f0 -- \
  internal/config/ir.go internal/config/json.go \
  internal/config/predicate_table_test.go internal/eval/eval_table_test.go \
  internal/eval/predicates.go internal/eval/trace.go \
  tests/eval-corpus/28-starts-with-email.json

git status --short
```
✅ **Checkpoint:** `git status` shows **7 files** (6 Go + 1 fixture) and **nothing under `js/`**. That's the "agent wrote the Go side" state, ready to fail on the missing TypeScript half.

---

## On stage (~12–15 min)

Each beat = **what to say** + **what to type**.

### 0 · The problem — ~45s, just talk
> "Agents made writing code cheap."
> "Now the bottleneck is *checking* it."
> "The old way: push, wait for CI, paste logs back to the agent, repeat."
> "Depot CI kills the wait — the agent runs real CI on its own uncommitted code, fixes itself, and only pushes when it's green."

> **💬 Deeper talk track (optional):**
> "The core shift is that agents make code generation *cheap*, but they make validation demand *explode*. If every agent-produced change still has to go through the old loop — push, wait, read logs, have an engineer copy context back to the agent, push again — you've lost all the velocity the agent just gave you."
> "What agents actually need is to call the real delivery pipeline *while they work*: run targeted CI against the local patch, inspect the result, fix what broke, rerun the same loop, and only push once it's already green."
> "And all of that has to sit on a fast, reliable execution layer for software delivery. That's what Depot is as a platform — and Depot CI is the product focused on giving agents that fast feedback loop against the *real* pipeline."
>
> Whiteboard / say-it shape if useful:
> ```text
> Old loop:
> edit -> push -> wait for CI -> move logs back into the agent context
>      -> agent fixes code -> push again -> repeat until green
>
> New loop:
> edit -> agent triggers targeted CI on the local patch -> agent reads status/logs
>      -> agent fixes code -> reruns the same loop -> push once green
> ```

### 1 · This is a real pipeline — ~45s
```bash
ls .depot/workflows
```
> "Not a toy. FalseFlag is a real feature-flag platform — Go API, TypeScript and Go SDKs, a Kubernetes operator, a dashboard, Postgres and SQLite, real test suites. The kind of pipeline most engineering teams actually run."

> **💬 Deeper talk track (optional):**
> "This is not a toy repo. FalseFlag is a synthetic feature-flag platform with a Go API, a Remix dashboard, a TypeScript SDK, a Go SDK, a Kubernetes operator, an MCP server, Hurl tests, Playwright tests, Docker images, Postgres *and* SQLite backends, generated code, and conformance tests across runtimes."
> "It's a fair representation of what a delivery pipeline actually looks like inside most engineering teams — which is the whole point. The loop you're about to watch runs against *that*, not a hello-world."

### 2 · Warm runners — ~90s
```bash
sed -n '15,40p' .depot/workflows/lint.yml
```
> "Our runners boot from a pre-baked image — Go, Node, Playwright, Postgres already inside. No waiting on cold installs. The agent just asks to run and the box comes up warm."

> **💬 Deeper talk track (optional):**
> "When we talk about caching inside Depot, we mean Depot Cache as a product that makes *every other product* faster. This image snapshots the expensive setup — Go, Node, pnpm, Playwright, Spectral, browser deps, the base Postgres image — so the agent never waits on a from-scratch dependency install just to get feedback."
> "The runner is automatically populated with that cache for anything the agent wants to validate. It just has to say it wants to run on this snapshot."
> "And notice the structure — setup and the checks themselves are laid out to run *in parallel*. That's what I mean by dynamic validation loops: independent checks run together, and the agent can pick this loop directly when the change calls for it. Same substrate lets an agent learn from the checked-in loops, construct a bespoke workflow for one specific change, and have Depot CI execute it against the local patch."

### 3 · ⭐ THE LIVE LOOP: fail → fix → green — ~3 min (centerpiece) — 🛟 fallback below if it stalls

Show the pre-staged Go diff (VS Code Source Control, or `git diff`).
> "I asked the agent to add a `starts_with` rule, Go side first. Here's the change — no commit, no push, just the working tree. Now watch it validate against real CI."

> **💬 Deeper talk track (optional, as you set it up):**
> "Now let's see what a coding agent can do on its own from a single prompt — validate its changes against the *real* delivery pipeline, with Depot CI as the interface for targeted validation of a code change."
> "There's no commit and no pull request here. Depot detects the local diff, uploads the patch, applies it after checkout, and runs the real workflow remotely — and that loop is automatically wired into the rest of the stack: Depot Cache, Depot Registry, Depot Container Builds."

Paste this into the agent (Claude Code / Cursor):
```text
I've added a `starts_with` string predicate to the FalseFlag targeting engine,
Go side only, plus a shared fixture under tests/eval-corpus/. Validate the
uncommitted working tree against real CI and fix whatever breaks.

Follow /fix-ci.
```

Narrate while it runs:
1. It uploads the **uncommitted diff** and runs real CI. → *"No other CI runs your uncommitted code."*
2. **It fails — for real.** The Go side has the new rule, the TypeScript side doesn't yet, and a shared test catches the mismatch.
3. It reads the logs itself, writes the ~15-line TypeScript twin, and reruns **only that one job**. → **Green.**
> "It didn't re-run everything — just the one check its change touched. Seconds, because the box was already warm."

> **💬 Deeper talk track (optional, to close the beat):**
> "The key thing: the agent drove the *entire* delivery pipeline itself. We did that by exposing every Depot CI component and its supporting systems as a CLI and an API — so the agent can make targeted runs to validate a change with no extra input from us."
> "And the whole Depot product surface is just running in the background making this orders of magnitude faster. The agent writes the code, gets real validation, turns CI green, and *then* pushes — never the other way around."

> **🛟 IF IT STALLS — paste these 2 edits, then run the rerun command at the bottom:**
>
> Edit 1 — `js/packages/sdk-js/src/ir.ts`: add `starts_with` to the `PredicateKind` list.
>
> Edit 2 — `js/packages/sdk-js/src/evaluator.ts`: add the case + helper:
> ```ts
>     case "starts_with":
>       return cmpStartsWith(p, ctx);
> ```
> ```ts
> function cmpStartsWith(p: Predicate, ctx: Record<string, unknown>): boolean {
>   const actual = lookupString(ctx, p.attr ?? "");
>   if (actual === undefined) return false;
>   if (typeof p.value !== "string") return false;
>   return actual.startsWith(p.value);
> }
> ```
> Rerun: `depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml --job conformance`

---

## BONUS beats — all optional, skip any if short on time

### 3.5 · Fan out the wider gate — ~45s (trim first)
```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/ci.yml \
  --job conformance --job test-go --job test-go-race --job test-js \
  --job build-js --job contract-test
```
Open the run URL — **8 jobs** light up at once (test-go-race and contract-test each split into Postgres + SQLite).
> "Same uncommitted diff, now against the full gate — both languages, race detection, contract tests on real Postgres and SQLite. The agent decides how much any change deserves."

### 3.6 · Pre-built base image — and how it's baked — ~90s
```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/lint.yml
```
Open the URL — runner ready in seconds, no cold toolchain on screen.
> "We bake the expensive setup once and snapshot the whole box. Every loop after that starts warm."

**Now show where that image comes from** — it isn't magic, it's its own workflow:
```bash
sed -n '1,54p' .depot/workflows/snapshot-e2e.yml   # one job installs the toolchain, then depot/snapshot-action freezes the box
```
> "One job installs the whole toolchain — Go, Node, pnpm, Playwright with Chromium, Spectral, the Postgres image — and `depot/snapshot-action` freezes the running box into `falseflag-ci-base`. That's the exact image `lint` and the e2e shards name in `runs-on`. Build the runner *once*; every loop after that boots from the frozen snapshot."

**Run the bake live (optional):**
```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/snapshot-e2e.yml
```
> ⚠️ This is a real **bake**, not a cache-hit — it installs the toolchain and snapshots the box, so it takes minutes, not seconds. Kick it off and talk over it, or (better) run it pre-show and just open the finished run. It only needs a standard `depot-ubuntu-latest` runner, so unlike the container-build jobs (Beat 3.8) it *does* run in this org.

### 3.7 · A scoped, agent-style workflow — ~90s
⚠️ **Frame as "the kind of workflow an agent generates" — it's committed (showed up in your Beat 1 `ls`), not written live.**
```bash
depot ci run --org 3njzjqc81m --workflow .depot/workflows/agent-validate.yml
```
> "A workflow scoped to just this kind of change — only the two checks an engine change can break, in parallel on the same warm image. Exactly the focused loop an agent writes."

### 3.8 · Build once, pull everywhere (container builds) — ~90s

> "One more mechanical win, separate from the agent loop. In a naive pipeline every job that needs your app images *builds* them — the smoke job builds, the e2e shards build, the scan job builds. The same images, over and over."
> "The fix is boring and huge: build **once**, save to Depot's ephemeral registry, and every downstream job just *pulls*."

**This repo already does exactly that.** Show the fan-out in `ci.yml`:
```bash
grep -n 'build-images\|pull-action\|build-id' .depot/workflows/ci.yml
```
> "One `build-images` job bakes every image and hands back a build ID. Then `image-scan`, `smoke`, and `dashboard-e2e` all declare `needs: build-images` and `pull` that same ID — no rebuilds. `dashboard-e2e` alone is 12 jobs, two backends times six shards, every one of them pulling the prebuilt image."

Now do it live — this is the `depot build` engine that job uses under the hood:
```bash
depot bake -f docker-bake.hcl --save --save-tag demo
```
> "Five images — api, proxy, operator, mcp, dashboard — built in parallel on Depot's remote BuildKit, native amd64 *and* arm64, no QEMU. Saved straight to the ephemeral registry."

Because we warmed it pre-show, **every layer comes back `CACHED`** and the whole bake lands in seconds.
> "That's the 'build from the image Depot already has' moment — the cache is shared across every runner and every teammate, so the second build of an unchanged image is basically free."

Then pull one image the way a downstream job would:
```bash
depot pull demo --project lgvdzr8ffq --target api
```
> "That's exactly what smoke and e2e do — pull the prebuilt image by tag or ID, never rebuild. Build once, pull everywhere."

> **💬 Deeper talk track (optional):**
> "This is Depot Container Builds plus the ephemeral registry doing for *images* what Depot Cache does for the *validation loop* — the expensive work happens once and every consumer reuses it. The agent's fail→fix→green loop runs on warm runners; the image fan-out runs on prebuilt, cached images. Same principle applied across the whole pipeline, and it's all the same platform the agent is already driving."

> **Single-image variant** — literal `depot build`, if you'd rather show one image cache-hit cleanly:
> ```bash
> depot build -f infra/Dockerfile --build-arg SERVICE=falseflag-api -t falseflag/api:dev --save .
> ```
> Run it twice: the first warms the layer + Go build cache, the second comes back all `CACHED` in seconds. Same NVMe build cache, shared across runners and teammates.

### 3.9 · Parallelism & sharding — ~90s (show, don't run)

> "Last mechanical win — this is the one we wrote up on the blog: how you actually make a big test suite *fast*. Two levers. **Parallelism** is using every core on one box. **Sharding** is splitting the suite across many boxes. The catch is that sharding multiplies setup — spin up twelve machines and each one pays the install tax — so done naively you can shard yourself *slower*."

Show the suite that does it right — `dashboard-e2e` in `ci.yml`:
```bash
sed -n '318,356p' .depot/workflows/ci.yml
```
> "Playwright, split **six shards × two backends = twelve jobs**, all in parallel. And every one of the twelve starts *warm and prebuilt*: it `pull`s the app images this run already baked — build once, Beat 3.8 — and it boots from the snapshot image with Chromium already inside. See `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — no per-shard browser download, because the runner snapshot from Beat 3.6 already has it. Loading a prebuilt image into a shard is about five seconds."

> **💬 Deeper talk track (optional):**
> "The blog's rule of thumb is **job density** — each shard should spend at least ~4× as long *testing* as it spends *setting up*, or you're paying to boot machines instead of running tests. Sharding only pays off if setup stays cheap, and cheap setup is exactly what build-once-and-pull (Beat 3.8) and the prebaked runner snapshot (Beat 3.6) buy you. In our own write-up that combination took a shard from ~14 setup steps and ~45s of setup down to ~6 steps and ~15s — about a minute off every push, all day long. It's the same principle as the agent loop, applied to the whole gate: do the expensive work *once*, and let every parallel consumer reuse it. Full write-up: depot.dev/blog/accelerating-test-suites"

> ⚠️ **Show this one, don't run it.** `dashboard-e2e` needs the container-build project (see Gotchas) — the point here is the *shape* of the file, not a live run. Fan the **8 jobs** live in Beat 3.5 and talk about the full 27-job, twelve-shard expansion.

---

## Back to the main line

### 4 · The feature goes live in the app — ~90s
CI is green, still nothing pushed. Ship the working tree into the running product:
```bash
docker compose up -d --build api proxy
```
```bash
# Create project + flag + the starts_with rule (plumbing — just run it)
curl -s -X POST localhost:8080/v1/projects -H 'Content-Type: application/json' \
  -d '{"slug":"webinar","display_name":"Webinar","config_strategy":"json"}'

curl -s -X POST localhost:8080/v1/projects/webinar/flags -H 'Content-Type: application/json' \
  -d '{"key":"new-onboarding","name":"New Onboarding","value_type":"boolean","default_value":false}'

curl -s -X PUT localhost:8080/v1/projects/webinar/flags/new-onboarding -H 'Content-Type: application/json' \
  -d '{"strategy":"json","source":{"value_type":"boolean","default":false,"rules":[
        {"id":"r1","when":{"kind":"starts_with","attr":"user.email","value":"beta-"},"value":true}]}}'
```
```bash
# THE PAYOFF — evaluate two users live
# beta- user -> true
curl -s -X POST localhost:8080/v1/projects/webinar/flags/new-onboarding/evaluate \
  -H 'Content-Type: application/json' -d '{"context":{"user":{"email":"beta-ada@example.com"}}}'

# regular user -> false
curl -s -X POST localhost:8080/v1/projects/webinar/flags/new-onboarding/evaluate \
  -H 'Content-Type: application/json' -d '{"context":{"user":{"email":"carol@example.com"}}}'
```
Flip to the dashboard — the `webinar` flag is right there.
> "The agent wrote it, real CI validated it on both runtimes, and it's serving live decisions — and we still haven't pushed a commit."

### 5 · Push once, already green — ~30s
```bash
git add -A && git commit -m "feat(eval): add starts_with predicate" && git push origin main
```
> "One push, already green. The agent never pushed anything broken."

⚠️ **In rehearsal, do NOT push to `main`.** Push a throwaway branch and open a PR
— CI fires on `pull_request → main`, so you get the **full pipeline running for
real** without ever touching `main`. Then delete everything and you're reset to
run the demo again.

> ⚠️ **This repo is a fork.** `origin` is `boscloud-engine/false-flag-demo`; its
> GitHub parent is `kylegalbraith/false-flag-demo`. Without `--repo`, `gh pr create`
> defaults the base to the **parent**, opening a cross-fork PR. Every `gh` command
> below pins `--repo boscloud-engine/false-flag-demo` so the PR stays **inside the fork**
> (base `main` and head both in `boscloud-engine`) — that's what fires `ci-baseline`.

**Commit + watch CI run:**
```bash
git switch -c rehearsal-throwaway
git add -A && git commit -m "feat(eval): add starts_with predicate"
git push -u origin rehearsal-throwaway
gh pr create --repo boscloud-engine/false-flag-demo --base main --head rehearsal-throwaway --fill
gh pr checks rehearsal-throwaway --repo boscloud-engine/false-flag-demo --watch
```
Or watch it in Depot: `depot ci run list --org 3njzjqc81m` (or the PR's Checks tab).

**Tear it back down so you can redo the demo:**
```bash
gh pr close rehearsal-throwaway --repo boscloud-engine/false-flag-demo --delete-branch
git switch main
git branch -D rehearsal-throwaway                 # delete the local branch (if --delete-branch didn't)
git checkout . && git clean -fd internal js tests # back to a clean main working tree
```
Then re-run **Before you go live → step 3** to re-stage the Go change for the next run.
✅ Everything stayed in `boscloud-engine/false-flag-demo`; `main` was never pushed to, and the disposable PR + branch are gone.

### 6 · Close — ~45s, just talk
> "The old model treats the human as the bottleneck — write, push, wait, read logs."
> "That breaks when agents ship ten times more changes."
> "Depot CI is a validation engine the agent can just call: runs uncommitted code, driven by API, cached, cheap enough to run constantly."
> "That's the wedge."

> **💬 Deeper talk track (optional):**
> "The old delivery-infrastructure model assumes the *human* is the scarce resource — a person writes code, pushes a branch, waits for CI, reads logs, decides what's next. That's already painful for teams, and it breaks completely once agents are producing many more candidate changes."
> "In an agentic world the bottleneck moves from *writing* code to *validating* it. The winning platform is the one agents can call continuously while they work. Depot CI isn't just a faster place to run a push-triggered workflow — it's a programmable validation engine."
> "The bigger shift is that validation volume explodes when agents write the code. The winning CI platform is no longer the one with the fastest runners — it's the one agents can use as *infrastructure*: fast startup, cache-backed, API-driven, observable, debuggable, cheap enough to call constantly. Depot starts as acceleration for builds and CI, and in an agentic world it becomes the validation substrate that lets code-writing agents ship safely. That's the wedge."

---

## Q&A — deeper talk tracks (if it comes up)

Pull from these only when asked; don't volunteer them on stage.

**"How is this actually different from faster CI?"**
> "Old delivery infra assumes humans are the scarce resource — write, push, wait, read logs, decide. That model breaks when agents produce far more candidate changes. The winning platform is the one agents can call *continuously* while they work. Depot CI isn't a faster push-triggered runner — it's a programmable validation engine the agent drives directly."

**"What do you mean by 'dynamic workflows'?"** — there are three levels, and Depot supports all three:
> 1. **Static workflow, dynamic targeting** — the agent picks `conformance`, `lint`, or `smoke` based on the change.
> 2. **Static workflow, dynamic subsets/matrices** — the agent runs a narrow slice of a larger workflow.
> 3. **Agent-generated workflow** — when the repo doesn't already express the needed check, the agent writes one and Depot CI executes it against the local patch.

**"Why does Depot win this?" (right-to-win / Series B)**
> "Depot is building the software-delivery infrastructure this new world needs — robust, comprehensive, highly reliable. CI providers of old are just workflow orchestration, which Depot also does — but Depot extends into distributed caching, integrations with tooling teams already use, all the way down to kernel-level filesystem tech. The advantage compounds across the surface: Depot CI handles orchestration and runner performance with little GitHub dependency; Depot Cache is plugged straight into the execution environment so cached results flow to the next runner automatically; Depot Registry gives each loop fast access to images and snapshots from earlier runs. That means the whole validation loop can be driven independently by agents inside their existing workflow — no testing locally then discovering CI behaves differently, no engineer copying logs between tools, no waiting on a push-triggered system to say what broke."

**"Where does this go next?"**
> "We're expanding Depot CI so agents can write *and* execute their own validation workflows however they want to express them, through this same interface. The hardest part is already solved — this validation engine is directly integrated with every other Depot component in our specialized delivery execution layer."

---

## If something breaks

- **Live run is slow:** open a `depot ci run list --org 3njzjqc81m` tab and show a recent green run, or play the screen recording.
- **Agent botches the TS twin:** paste the 🛟 fallback in Beat 3, rerun `--job conformance`.
- **App didn't pick up the change (Beat 4):** rerun `docker compose up -d --build api proxy`.
- **DB has rehearsal leftovers:** reset and reseed —
```bash
docker compose exec -T db psql -U falseflag -d falseflag \
  -c "TRUNCATE TABLE audit_events, snapshots, segments, environments, flag_versions, flags, projects RESTART IDENTITY CASCADE"
make seed
```
- **Don't run `build-images` / `dashboard-e2e` live** — they need extra setup. Fan out the 8 jobs live and just *talk about* the full 27-job expansion.
- **`depot bake` is slow on stage (Beat 3.8):** you skipped the prewarm, so it's building cold. Jump straight to `depot pull demo --project lgvdzr8ffq --target api` instead — the cache is the whole point, never bake cold live.
- **`snapshot-e2e` is slow on stage (Beat 3.6):** it's a real bake, not a cache-hit — minutes by design. If you didn't pre-run it, just `sed -n '1,54p' .depot/workflows/snapshot-e2e.yml` to show the file and open a prior run from `depot ci run list --org 3njzjqc81m`; don't wait on a cold bake live.

## Quick checklist

- [ ] Caches warmed — a fresh `--job conformance` comes back fast.
- [ ] Container-build cache warmed (only if doing Beat 3.8) — `depot bake … --save --save-tag demo` ran once; a second run is all `CACHED`.
- [ ] Runner snapshot pre-baked (only if doing Beat 3.6's live bake) — `snapshot-e2e.yml` ran once; you have a finished run URL to open if a cold bake is too slow on stage.
- [ ] App up at `:3030`, seeded.
- [ ] Go change pre-staged — `git status` shows 7 files, nothing under `js/`.
- [ ] Screen recording of a clean run saved as a fallback.

## Tear down
```bash
git checkout main && git checkout . && git clean -fd internal js tests
docker compose down        # add -v to also wipe the DB volume
```

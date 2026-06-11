# Depot CI Agentic Validation Demo

Run-through for the Depot CI Demo product discussion. The goal is a punchy 5-10
minute demo that makes "dynamic workflows" and "intelligence around validation
loops" concrete without overclaiming magic.

## Opening

The differentiation is the stack we have built for software delivery on Depot working together:

- Depot CI for orchestration.
- Depot Cache for incremental rebuilds and tests.
- Depot Registry for fast artifact handoff between jobs.
- Depot Container Builds for native, cached image builds.
- CLI/API/logs/status/SSH for agents and engineers to drive the loop directly.

That combination enables targeted feedback loops for agents, whether they call
static workflows, select a narrow job from a larger workflow, or generate a
dynamic workflow on the fly.

## 1. Set The Problem, 45 Seconds

**Talk track:**

The core shift is that agents make code generation cheap, but they make
validation demand explode. If every agent-produced change has to go through the
old loop of push, wait, read logs, have an engineer copy context back to the agent, and push again, you lost all of the new velocity of agents writing code.

What agents really need is a way to call the real delivery pipeline while they are
working: run targeted CI against the local patch, inspect the result, fix what
broke, rerun the same loop, and only push once the change is already green.

You need all of that to be backed by a fast and reliable execution layer for software delivery. That's what Depot is as a platform and Depot CI is the latest product that focuses on fast feedback loops for agents so that they can validate their changes against the real delivery pipeline.

Show:

```text
Old loop:
edit -> push -> wait for CI -> move logs back into the agent context
     -> agent fixes code -> push again -> repeat until green

New loop:
edit -> agent triggers targeted CI on the local patch -> agent reads status/logs
     -> agent fixes code -> reruns the same loop -> push once green
```

## 2. Show The Repo Has Real CI Gravity, 60 Seconds

**Talk track:**

This is not a toy repo. FalseFlag is a synthetic feature flag platform with a
Go API, Remix dashboard, TypeScript SDK, Go SDK, Kubernetes operator, MCP
server, Hurl tests, Playwright tests, Docker images, Postgres and SQLite
backends, generated code, and conformance tests across runtimes.

It's a representation of what a delivery pipeline looks like inside of most engineering teams.

Show the workflows:

```bash
ls .depot/workflows
```

## 3. Show The Optimized Validation Substrate, 90 Seconds

**Talk track:**

When we talk about caching inside of Depot we're talking about how Depot Cache as a product makes every other product faster.

Open:

```bash
sed -n '1,180p' .depot/workflows/lint.yml
```

Show the custom image:

```yaml
runs-on:
  size: 4x16
  image: d58mfwccbf.registry.depot.dev/falseflag-ci-base:go1.26-node22-pnpm10.13-pw1.49-spectral6.14-postgres16
```

**Talk track:**

This how we leverage Depot Cache for customers inside of Depot CI.
This snapshots the expensive setup: Go, Node, pnpm, Playwright, Spectral,
browser dependencies, and the base Postgres image. The agent does not wait for
dependency installation from scratch every time it wants feedback.

The runner is automatically populated with this cache for anything the agent wants to validate.

It just has to specify that it wants to run on this snapshot.

```yaml
parallel:
  - name: go mod download
  - name: pnpm install
```

```yaml
parallel:
  - name: Check codegen freshness
  - name: Lint go
  - name: Lint JavaScript
  - name: Typecheck
  - name: Lint OpenAPI
```

**Talk track:**

Show parallel setup and validation in `.depot/workflows/lint.yml`:

This is what I mean by dynamic validation loops. The workflow is structured so
independent checks can run together, and the agent can choose this loop directly
when the change calls for it.

The same substrate also lets an agent learn from the checked-in validation loops,
construct a bespoke workflow for a specific change, and have Depot CI execute it
against the local patch.

## 4. Live Agentic Loop, 2-3 Minutes

**Talk track:**

Now lets see what a coding agent can do by itself with a single prompt and validate it's changes against the real delivery pipeline using Depot CI as the main interface
for executing targetted validation given a code change.

This is the centerpiece. Use one prompt that forces a real CI-guided loop.

Agent prompt to paste:

```text
Add a new `starts_with` string predicate to the FalseFlag targeting engine.
Focus only on the Go implementation for now and only address other runtimes if
Depot CI proves they fail.

Make sure you add a shared fixture under `tests/eval-corpus/**`.
```

Expected failure path:

The Go runtime learns `starts_with` first, but the TypeScript SDK evaluator does
not know it yet. The shared conformance job fails with a real cross-runtime
mismatch. The agent reads the logs, adds the TypeScript twin, and reruns only
`conformance`.

**Talk track while it runs:**

What we are seeing here is Codex really taking our prompt, building out the necessary changes, and then there is no commit or pull request. Instead the agent can use Depot to validate it's changes in real-time using Depot CI.

Depot detects the local diff, uploads a patch, applies it after checkout, and runs the real workflow remotely. This validation loop is automatically connected into all of the other Depot products like Depot Cache, Depot Registry, and Depot Container Builds.

Commands to narrate if needed:

```bash
depot ci status <run-id>
depot ci diagnose --org d58mfwccbf --run <run-id>
depot ci logs <run-id> --job conformance
```

**Close the beat:**

The key thing here is that an agent is able to drive the entire delivery pipeline itself. This is done by us exposing all of the Depot CI components and supporting systems as a CLI & API. This allows the agent to make targetted runs to validate code changes without any additional input from us.

All of the products of Depot are just running in the background making this pipeline
orders of magnitude faster. So the agent can write the code, get validation, turn CI green, and then push the code.

## DO THIS SECTION AS CLOSING

## 6. Answer "How Is This Different?", 60 Seconds

**Talk track:**

The old delivery infrastructure model assumes humans are the scarce resource. A human writes code,
pushes a branch, waits for CI, reads the logs, and decides what to do next. That
model is already painful for teams, but it breaks completely when agents start
producing many more candidate changes.

In an agentic world, the bottleneck moves from writing code to validating code.
The winning delivery infrastructure platform is the one agents can call continuously while they work.

That is the difference with Depot. Depot CI is not just a faster place to run a
push-triggered workflow. It is a programmable validation engine.

**Use this if right to win type stuff comes up**

Ultimately, Depot is building the software delivery infrastructure we need for this
new world of software engineering. A robust, comprehensive, highly reliable delivery
infrastructure layer. CI providers of old are just workflow orchestration, which Depot
also provides, but Depot also extends into distributed caching, integrations with tooling that customer already use, all the way down to kernel-level filesystem technology. This is all in service of making everything in the delivery stack fast and reliable to meet the demands of this new found code velocity.

**Then add:**

The advantage compounds across the product surface. Depot CI handles the
orchestration, runner performance, and workflow plumbing with very little
dependency on GitHub. Depot Cache is plugged directly into the execution
environment, so cached results are available to the next runner automatically.
Depot Registry gives each validation loop fast access to the images and
environment snapshots produced by earlier runs.

That means the entire validation loop can be driven independently by agents
inside their existing workflow. They do not have to test something locally,
discover CI behaves differently, have an engineer copy logs between tools, or wait for a push-triggered system to tell them what broke. The agent can run the same CI
environment it will be judged by, inspect the result, fix the code, and rerun
the targeted loop immediately.

**If they ask specifically about dynamic workflows:**

There are three levels. Level one is a static workflow with dynamic targeting:
the agent picks `conformance`, `lint`, or `smoke` based on the change. Level two
is a static workflow with dynamic subsets and matrices. Level three is an
agent-generated workflow when the repo does not already express the needed
check. Depot supports all three of these.

## Future looking: agent written validation expansion

We intend to expand the functionality across Depot CI to make things even more
generic and accessible to agents so that they can write & execute their own
validation workflows, however they want to express them, via this same interface.

We've already solved the hardest part of that problem by having this validation
engine being directly integrated with all of the other Depot components in our
specialized delivery execution layer.

## 7. Close With The Series B Story, 45 Seconds

**Talk track:**

The bigger market shift is that validation volume explodes when agents are
writing code. The winning CI platform is no longer just the one with faster
runners. It is the one agents can use as infrastructure: fast startup,
cache-backed, API-driven, observable, debuggable, and cheap enough to call
constantly.

**Then:**

That is the wedge. Depot starts as acceleration for builds and CI, but in an
agentic world it becomes the validation substrate that lets code-writing agents
ship safely.

## Commands Cheat Sheet

Narrow local-patch runs:

```bash
depot ci run --org d58mfwccbf --repo Zagrit-HQ/false-flag-demo --workflow .depot/workflows/lint.yml
depot ci run --org d58mfwccbf --repo Zagrit-HQ/false-flag-demo --workflow .depot/workflows/ci.yml --job conformance
depot ci status <run-id>
depot ci diagnose --org d58mfwccbf --run <run-id>
depot ci logs <run-id> --job conformance
```

Custom image:

```bash
depot ci run --workflow .depot/workflows/snapshot-e2e.yml
```

Local app smoke:

```bash
docker compose up -d --build
make seed
make smoke
```

Repo inspection:

```bash
ls .depot/workflows
rg '^  [a-zA-Z0-9_-]+:' .depot/workflows/ci.yml
sed -n '1,180p' .depot/workflows/lint.yml
sed -n '1,220p' .depot/workflows/build.yml
```

## Talk Track In One Paragraph

Depot's pitch for agentic development is not "we made runners faster." It is:
we made CI callable. An agent can run real CI against local uncommitted code,
target only the validation loop that matters, reuse cached dependencies and
images, read status and logs through the CLI/API, debug with SSH if needed, and
rerun until green before pushing. That is what turns CI from a human-paced gate
into infrastructure for agent-driven development.

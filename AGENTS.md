# Project Instructions

## Product Goal

Build a believable, intentionally large feature flag platform for a conference demo about accelerating slow CI/CD with Depot. The software should look like it works, but it does not need production-grade hardening. Prefer broad, credible surface area and passing commands over deep implementation detail.

Use these docs as the main planning references:

- `docs/METAPLAN.md`
- `docs/ideation/2026-05-20-synthetic-feature-flag-platform-depot-demo-ideation.md`
- `docs/ideation/2026-05-20-moonconfig-historical-reference.md`

When the user asks "what's next?", inspect `docs/METAPLAN.md` and continue from the first incomplete checklist item.

## Chosen Stack

Backend and platform:

- Go for backend services, operator, proxy, SDK, and MCP server.
- Keep Go implementation code under `internal/**`; do not introduce a Go `pkg/**` tree.
- Follow `/Users/wito/code/project-depot/registry` as a Go repository shape reference: `cmd/**` entrypoints, `internal/**` packages, `internal/db` SQLC output, root `proto`, root `sqlc.yaml`, and `tests/hurl`.
- ConnectRPC or gRPC with Buf-managed protobuf definitions.
- `oapi-codegen` for OpenAPI Go generation.
- `pgxpool` + SQLC + goose for relational persistence.
- `go-redis` for Redis integration.
- OpenTelemetry + Prometheus for observability.
- Standard `log/slog` for logging. Do not use zap or zerolog unless explicitly requested.
- `golangci-lint` and `gotestsum` for Go quality/test tooling.
- Kubebuilder/controller-runtime for the Kubernetes operator.
- Helm and Kustomize for Kubernetes packaging.

Frontend and TypeScript:

- Remix for the dashboard.
- Tailwind for styling.
- Radix UI for custom component primitives.
- Biome for TypeScript linting/formatting.
- Vitest for TypeScript tests.
- pnpm workspaces + Turborepo for the TypeScript monorepo.
- Zod for schemas and validation.
- Orval for OpenAPI TypeScript client generation.
- Commander for the TypeScript CLI.
- Playwright for browser tests.
- Hurl for HTTP API e2e and smoke tests.
- Keep all TypeScript code and TypeScript workspace files under `js/**`.

Code generation and CI:

- Include Buf, SQLC, controller-gen, OpenAPI generation, and Orval generation in generated-code checks.
- CI should have credible slow surfaces: Go tests, TypeScript builds, generated code checks, Docker builds, browser tests, Hurl API e2e tests, Kubernetes/operator tests, backend matrices, and config compiler tests.

## Local Ports

The compose stack uses the following ports; keep new binaries on a contiguous range.

| Service   | Ports      | Notes                                    |
| --------- | ---------- | ---------------------------------------- |
| api       | 8080, 8090 | REST + ConnectRPC                        |
| proxy     | 8081       | Local snapshot evaluation                |
| operator  | 8082, 8083 | Metrics + health probe                   |
| mcp       | 8091, 8092 | Streamable HTTP MCP surface + `/healthz` |
| dashboard | 3000       | Remix SSR                                |
| db        | 5432       | Postgres                                 |

`cmd/falseflag-mcp` exposes six agent-facing tools — `list_projects`,
`list_flags`, `get_flag`, `validate_config`, `explain_evaluation`,
`search_audit_log` — via the official `modelcontextprotocol/go-sdk`.
`make mcp-smoke` exercises the surface end-to-end through Hurl
against the compose stack. See `cmd/falseflag-mcp/README.md`.

## Implementation Bias

- Demo-quality is the target. Stub internals when needed, but keep commands, APIs, UI routes, and tests believable.
- Every implementation slice should end with the validation ladder in `docs/METAPLAN.md`: compile/build checks, API or runtime smoke checks, demo-path checks when applicable, and a status note recording what ran.
- Configuration is project-scoped: a project chooses one active strategy at a time (`json`, `cel`, or `typescript`), and each strategy compiles to the same normalized release snapshot.
- Runtime SDKs and the evaluation proxy should consume static JSON/rules, not execute user-submitted TypeScript.
- Use parallel subagents only when write scopes are clearly separate.

## Depot CI Continuous Verification

For code changes in this repo, use the `depot-ci` skill for the mechanics of continuous verification before committing, pushing, or reporting the work as complete. Let that skill decide the exact `depot ci` subcommands to use for running, inspecting status, reading logs, diagnosing, retrying, or debugging a run.

Repo-specific Depot CI defaults:

- Depot org: `3njzjqc81m`
- GitHub repo: `boscloud-engine/false-flag-demo`
- Main workflow: `.depot/workflows/ci.yml`
- Fast validation workflow: `.depot/workflows/lint.yml`

Always pass the org and repo explicitly when running Depot CI so the CLI does not choose the wrong account:

```bash
depot ci run --org 3njzjqc81m --repo boscloud-engine/false-flag-demo --workflow .depot/workflows/ci.yml --job <job>
```

Before running Depot CI, check `git status --short`. If the validation depends on newly created files, stage those files first so Depot's uploaded patch includes them. Do not commit unless the user asked for a commit.

Choose the smallest relevant validation loop:

- Eval engine, SDK behavior, or `tests/eval-corpus/**`: `conformance`
- Go-only backend changes: `test-go`
- TypeScript-only changes: `test-js` or `build-js`
- Codegen, lint, OpenAPI, or typecheck changes: `.depot/workflows/lint.yml`
- API/proxy/MCP runtime behavior: `smoke`
- Dashboard browser behavior: `dashboard-e2e`
- Docker/image changes: `build-images`

If Depot CI cannot start because of auth, org, repo access, or network issues, report that blocker explicitly. Do not silently replace Depot CI with local-only checks.

If a Depot CI run, workflow, job, or attempt fails, use `depot ci diagnose` before broad local debugging. The command takes explicit ID flags, not a bare positional ID:

```bash
depot ci diagnose --org 3njzjqc81m --run <run-id>
depot ci diagnose --org 3njzjqc81m --job <job-id>
depot ci diagnose --org 3njzjqc81m --attempt <attempt-id>
```

Use the diagnosis to identify the likely cause, then fetch focused logs with `depot ci logs` only as needed and keep the fix scoped to the failing validation loop.

After the targeted loop is green, run the broader relevant Depot CI coverage
before reporting the work as complete. The targeted job is for fast iteration;
the broader run is for confidence.

Use judgment based on the files changed:

- Eval engine or shared corpus changes: rerun `conformance`, then run `test-go`
  and `test-js` if both Go and TS code changed.
- API/proxy/MCP runtime changes: run the targeted job first, then `smoke`.
- Dashboard behavior changes: run the targeted JS job first, then
  `dashboard-e2e`.
- Docker or workflow changes: run `build-images` and any downstream job that
  consumes those images.
- Codegen/schema changes: run `.depot/workflows/lint.yml`, then the affected
  build/test jobs.

Keep the broader run scoped to the code change. Do not blindly run the entire
pipeline for every small edit unless the change touches shared contracts,
workflow definitions, generated code, or release/build plumbing.

## Sandboxed agents and running local Go checks

When running local Go checks from a sandboxed agent, use a workspace-local Go
cache to avoid host cache permission noise:

GOCACHE=$(pwd)/.gocache go test ./internal/config ./internal/eval

## Inspiration Projects

Reference material for this project lives outside this workspace at:

```text
/Users/wito/code/project-keat
```

Use those projects as read-only inspiration when designing or implementing this repository. In particular, inspect the Keat server, SDK, release tooling, Kubernetes manifests, CRDs, dashboard, and git history when they are relevant to feature flag architecture, Kubernetes-native workflows, or CI/CD demo design.

Read-only Git history inspection is allowed and encouraged, for example:

```bash
git -C /Users/wito/code/project-keat/keat-server log --oneline
git -C /Users/wito/code/project-keat/keat-server show <commit>
git -C /Users/wito/code/project-keat/keat-server blame <file>
```

Do not edit files under `/Users/wito/code/project-keat` unless the user explicitly asks for changes there and grants the necessary workspace access.

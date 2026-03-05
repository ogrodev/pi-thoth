# Repository Guidelines

## Project Overview

pi-thoth is a Bun + TypeScript monorepo providing semantic code search, persistent memory, and context compression for AI assistants via MCP (Model Context Protocol).

Architecture: single-process MCP server (`apps/pi-thoth`) that calls `@th0th/core` directly — no HTTP, no separate API server.

## Architecture & Data Flow

```
Editor/agent (stdio) → apps/pi-thoth → @th0th/core → SQLite (<project>/.th0th/data/)

### Core architecture contract (`packages/core/src`)
- `tools/` — thin input schema + delegation (MCP-facing)
- `controllers/` — orchestration and response shaping
- `services/` — domain logic (search, embeddings, graph, cache, jobs)
- `data/` — persistence (SQLite/vector/keyword/memory repositories)

Keep this layering intact. Do not push business logic into `tools/`.

### When adding a new tool
1. Add tool class in `packages/core/src/tools/`
2. Export from `packages/core/src/tools/index.ts` and `packages/core/src/index.ts`
3. Register in `apps/pi-thoth/src/tool-registry.ts` with its MCP name
4. No HTTP routes needed — direct call via `handler.handle(args)`

## Key Directories

- `apps/pi-thoth/src/` — MCP server (`index.ts`), CLI (`cli.ts`), tool registry (`tool-registry.ts`), Ollama bootstrap (`ollama-bootstrap.ts`)
- `packages/core/src/` — core domain implementation (4-layer architecture)
- `packages/shared/src/` — shared config, env, utilities, and types
- `packages/core/src/__tests__/` — automated test suite (Bun tests)
- `scripts/` — setup and release helper scripts
- `.github/workflows/` — CI and publish pipelines

## Development Commands

Run from repo root:

```bash
bun install
bun run build
bun run type-check
bun run test
```

Setup:

```bash
bunx pi-thoth-config init              # per-project: creates .th0th/config.json + .th0th/data/
bunx pi-thoth-config init --global     # global template: ~/.config/th0th/config.json
bunx pi-thoth-config show              # print project config (falls back to global)
bunx pi-thoth-config use mistral --api-key YOUR_KEY
```

Run MCP server locally (must be in a project with `.th0th/config.json`):

```bash
bun apps/pi-thoth/src/index.ts
```

## Code Conventions & Common Patterns

- **Tool response shape**: `{ success: true, data }` or `{ success: false, error }`
- **Singleton controllers/services**: expose `static getInstance()`, manually reset in tests
- **Thin transport**: tool-registry delegates to core; no business logic in `apps/pi-thoth/`
- **Async style**: `async/await` with selective `Promise.all` for parallel work
- **File naming**: `kebab-case.ts` for controllers/services/data; `snake_case.ts` for tool files (MCP tool parity)
- **Search stack**: hybrid vector + keyword ranking with RRF; filters use glob/minimatch

## Important Files

- `package.json` — root scripts/workspaces/runtime pin (`bun@1.2.0`)
- `turbo.json` — task graph (`test` depends on `build`, `type-check` depends on upstream `build`)
- `bunfig.toml` — Bun test/coverage defaults
- `apps/pi-thoth/src/index.ts` — MCP server bootstrap and request handlers
- `apps/pi-thoth/src/tool-registry.ts` — MCP name → core handler mapping
- `apps/pi-thoth/src/cli.ts` — `pi-thoth-config` CLI
- `apps/pi-thoth/src/ollama-bootstrap.ts` — Ollama install/start/pull logic
- `packages/core/src/index.ts` — core public surface
- `packages/core/src/controllers/search-controller.ts` — orchestration example
- `packages/core/src/services/search/contextual-search-rlm.ts` — central search engine
- `packages/core/src/data/memory/memory-repository.ts` — raw memory persistence
- `packages/core/prisma/schema.prisma` — analytics schema (SQLite via bun-sqlite adapter)
- `.env.example` and `.env.local-first` — environment templates

## Runtime & Tooling

- **Package manager/runtime**: Bun (pinned in `packageManager`). Use `bun`/`bunx`.
- **Monorepo orchestration**: Turborepo (`turbo run ...`)
- **TypeScript**: strict mode; package-level tsconfigs extend root baseline
- **Prisma**: `@th0th/core` requires `prisma generate` during build (`prebuild` handles this automatically)
- **Lint/format**: root `lint` script exists; no eslint/biome/prettier config currently present

## Testing & QA

- Test framework: Bun native test runner (`bun:test`)
- Test location: `packages/core/src/__tests__/`
- Coverage: enabled via `bunfig.toml`, output to `./coverage`
- CI (`.github/workflows/ci.yml`): install → type-check → build → test

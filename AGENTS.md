# AGENTS.md

Guide for coding agents and new developers. The [README](README.md) is the full reference; this
file only lists the layout, the commands and the rules.

## What this repo is

Four runnable examples (`resume-creation`, `trip-planning`, `social-media-team`,
`rag-knowledge-base`) that port KaibanJS examples onto the published `kaiban-distributed` npm
package. Each agent is its own worker process; a short-lived orchestrator drives the phases.
Design overview: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Deployment:
[`DEPLOYMENT.md`](DEPLOYMENT.md).

## Layout

- `<example>/`: `team-config.ts`, one `<role>-node.ts` per agent, `phases.ts`, `orchestrator.ts`,
  `docker-compose.yml` (some also `docker-compose.kafka.yml`) and a README.
- `shared/`: board state publisher, run logger, gateway connection, agent-card parser, env readers, terminal prompt, run-end and stop handling (table in `docs/ARCHITECTURE.md`).
- `viewer/`: static HTML board. `scripts/run-example.sh`: start or stop one example.
- `docker-compose.infra.yml`: Redis and gateway only, for the ts-node development path.
- `Dockerfile`: one image for every role. `.github/workflows/ci.yml`: install, typecheck, test, build.

## Commands

```bash
npm ci                  # install exactly what package-lock.json pins
npm run typecheck       # tsc --noEmit
npm test                # 26 deterministic tests (no Redis, no network, no Docker)
npm run build           # tsc into dist/ (ignored by git)
```

The tests in `tests/` cover the shared helpers, the failure paths and the compose and orchestrator
wiring; they need no key and no Docker. `tests/wiring.test.ts` counts the compose files ("there are
seven compose files"): raise the number when you add one. Running an example needs an LLM key and
Docker; see the README quick start. Never put real keys in tracked files: `.env` is git-ignored, `.env.example` is the
template.

## Rules

- Keep each example's file roles as described in the README section "How a port is structured".
- When a variable, port or command changes, update the README, `DEPLOYMENT.md`, `.env.example`
  and the example's README together.
- This repo depends on the published package, not on a local copy: check the version in
  `package.json` before describing core behaviour.

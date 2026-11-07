# Kaiban Distributed Systems

> **Multi-agent AI as distributed, stateful actors.**

Most agent frameworks ship as monolithic sequential scripts: when one step
crashes it can break the whole run, and "scaling" means a bigger box or paying for different online services.
**[Kaiban Distributed](https://github.com/andreibesleaga/kaiban-distributed)**
is the **first project to bring the Actor-Model paradigm to Multi-Agent Systems (MAS)** in
the JavaScript/TypeScript/Node.js ecosystem — an experimental, **production-shaped** runtime
where every agent is a **stateful actor in its own process**, communicating only by messages
over a pluggable **enterprise bus (Kafka / Redis-BullMQ)**. If an agent fails it
crashes *cleanly* — Erlang/Kafka **"let it crash → DLQ"** applied to AI — without corrupting
the fleet, and you scale **horizontally** (in the core repo's `global-research` example: `docker compose up --scale searcher=8`) as well as
**vertically** per node. This repo is a set of **runnable, completely-working examples** built
on that runtime; the live **Kanban board** renders every agent moving TODO → DOING → DONE in
real time.

**What makes it unique** — a combination in JS/TS, for agents *and* humans:

- 🧩 **Swappable messaging layer** — toggle **Redis ⇄ Kafka** with *zero* worker-code
  changes, and drop agents straight onto messaging infrastructure you already run.
- 📋 **Legible workflows** — a live **Kanban board** simple viewer, where **Human-in-the-Loop is a first-class
  workflow column**: visualize, pause, and intervene on the hard tasks.
- 🔌 **Standard federation** — built-in **A2A** gateway + **MCP** server/client (each agent can be
  its own A2A/MCP client or server), so a KaibanJS agent can orchestrate alongside **LangGraph /
  CrewAI** agents from different backends on one board.
- 🛡️ **FinOps & governance** — a hot-path **action gate** blocks rogue behavior *before* tokens are
  spent; hard `MAX_WORKFLOW_COST_USD` ceilings, audit logs, **OpenTelemetry**, GDPR-conscious.
  The runtime's README also lists SOC 2 control support, 100% core test coverage, real-broker chaos
  suites and a signed supply chain; those are claims about the runtime, not checked in this repo.
- ⚖️ The core library (`kaiban-distributed` on npm) is **Apache-2.0** — safe to build on commercially. This examples repository is GPL-3.0-or-later.

<table align="center">
  <tr>
    <td align="center" width="33%"><a href="images/KaibanExamples1.png"><img src="images/KaibanExamples1.png" alt="Static viewer (viewer/board.html) while social-media-team runs: six agents, two composers executing" /></a><br/><sub>social-media-team running in the static viewer</sub></td>
    <td align="center" width="33%"><a href="images/KaibanExamples2.png"><img src="images/KaibanExamples2.png" alt="Static viewer after the social-media-team run: content pack done, token and cost totals, event stream" /></a><br/><sub>the same run finished: cost totals and event stream</sub></td>
    <td align="center" width="33%"><a href="images/KaibanExamples3.png"><img src="images/KaibanExamples3.png" alt="Static viewer after the rag-knowledge-base run: workflow complete banner and three answered questions" /></a><br/><sub>rag-knowledge-base finished (answers grounded in the stored content; needs <code>OPENAI_API_KEY</code>)</sub></td>
  </tr>
  <tr>
    <td align="center"><a href="images/viewer-stop-all.png"><img src="images/viewer-stop-all.png" alt="Static viewer with the STOP ALL button in the header, control plane on" /></a><br/><sub>static viewer with the STOP ALL button (control plane on)</sub></td>
    <td align="center"><a href="images/KaibanExamples4.png"><img src="images/KaibanExamples4.png" alt="React board of the kaiban-distributed core repo: trip-planning waiting for a human decision with Approve, Revise and Reject buttons" /></a><br/><sub>trip-planning on the core repo's React board, waiting for a human decision (this repo's viewer is read-only)</sub></td>
    <td align="center"><a href="images/KaibanExamples5.png"><img src="images/KaibanExamples5.png" alt="React board of the kaiban-distributed core repo: trip-planning workflow finished" /></a><br/><sub>the same React board, workflow finished</sub></td>
  </tr>
</table>

<sub align="center">↑ click any image to open it at full size</sub>

### These examples are deliberately simple — the point is the substrate

Each example here ([KaibanJS example](https://www.kaibanjs.com/examples) ports) could be implemented
in plain KaibanJS easier, but they exist here to make the **distributed substrate tangible**:
the *same* agent code running as independent, message-passing, individually-scalable, observable
services with **checkpoint/resume** and **HITL**. The real payoff arrives at Enterprise Scale —
where Kaiban Distributed is meant to live:

- **Drop agents onto streams you already have.** Point a worker at an existing **Kafka topic /
  Redis stream** and let agents read live data — transactions, logs, support tickets,
  telemetry, industrial/IoT events — and *act* on it, with infinite-retention logs, schemas, and
  near-real-time analytics from the underlying broker for free.
- **Absorb event spikes elastically.** A *Customer-Support mega-incident*: webhooks stream thousands
  of tickets into the A2A gateway, which load-balances across many "triage" nodes that use MCP to
  check customer/issue/severity and draft responses or escalate (awaiting validation) — scale nodes
  up during the spike, back down to save cost.
- **Run compliance-critical swarms.** A *Financial-Audit* swarm (OCR → Risk → Compliance → Fraud)
  that triggers a **HITL pause** the moment a violation is found and surfaces it on the board for
  manual sign-off — the level of control enterprises require.
- **Make classic, distributed software flows agentic.** Wrap existing microservice/streaming
  pipelines with agents plus human checkpoints so the most complex tasks — reading streams of
  information and running whole systems of work on them — become legible, governable, and affordable.

> 📖 Built alongside and featured in the author's upcoming book **Agentic AI Architectures**. Deep dive:
> the [Kaiban Distributed](https://github.com/andreibesleaga/kaiban-distributed) runtime (v2.1.2), with its examples (`blog-team` and `global-research`),
> and its [companion Medium article](https://lnkd.in/d_DSNFju).

> This is a separate repo by design — the core `kaiban-distributed` package keeps 100% coverage
> gate and core-only published artifact; these examples depend on the **published** package
> (`kaiban-distributed` + `kaiban-distributed/shared`), each agent its own worker process with a
> mailbox, coordinated over the message bus.
>
> Check the original repo [Kaiban Distributed](https://github.com/andreibesleaga/kaiban-distributed) for React Board Viewer with HITL, observability and more. The React Board is a more powerful front-end that hooks into the system for advanced visualization of the workflow than this repo simple HTML/JavaScript `viewer`.

## Emergency STOP ALL

One command kills every running model call, task and workflow of a stack. It needs the
`kaiban-distributed` version in `package.json` and is **off by default**.

1. Set `CONTROL_PLANE_ENABLED=true` in `.env`. The compose files pass it to the gateway, every
   worker and the orchestrator; on the ts-node path it must be in the environment of each process.
2. Set `BOARD_JWT_SECRET` on the gateway. From then on the board needs a token even to connect, so
   open it with `#token=` (step 3). Without the secret the gateway refuses stop commands from the board.
   Create a board token (valid one hour) in the repo root, after `npm install`, with the same secret
   the gateway has:

   ```bash
   BOARD_JWT_SECRET=<the gateway's secret> node -e "console.log(require('kaiban-distributed').issueBoardToken('operator', 3600))"
   ```

   Every valid board token can issue STOP ALL; keep it as private as the secret.
   Set `CHANNEL_SIGNING_SECRET` too (the same value on every service; the compose files pass it):
   it signs the stop command and the saved stop marker. With `NODE_ENV=production` the gateway needs
   all three secrets (32 bytes or more, all different); see
   [DEPLOYMENT.md, "Before exposing the gateway"](DEPLOYMENT.md#before-exposing-the-gateway).
3. Stop from the viewer: open `viewer/board.html#token=<board token>` (or
   `viewer/board.html?gateway=http://localhost:3000#token=<board token>`). The **STOP ALL** button
   appears when the gateway reports the control plane. The fragment is removed from the address bar
   after it is read; the token is not stored.
4. Or from a shell in the repo root (it reads `.env`): `npm run stop-all -- --reason "runaway loop"`.
   It needs `REDIS_URL` and, when you set one, `CHANNEL_SIGNING_SECRET`; without the secret the
   command prints a warning and nodes that sign ignore the stop.
   In a Docker stack: `docker compose -f <example>/docker-compose.yml exec gateway node node_modules/kaiban-distributed/dist/src/main/stop-all.js --reason "runaway loop"`.

A stopped orchestrator publishes the board status `STOPPED`, clears its checkpoint (the next run
starts fresh), ends the human-review wait, and exits with code 2. A stop reaches a social-media-team
fan-out too: the run ends `STOPPED` instead of paying for the aggregator.

Background (what is stopped, replay, clock notes): [Emergency STOP ALL](https://github.com/andreibesleaga/kaiban-distributed#emergency-stop-all-210)
in the runtime README.

## Exit codes

Every orchestrator ends with one of these codes:

| Code | Meaning |
|------|---------|
| 0 | Finished; or stopped by the budget guard (board status `STOPPED`, checkpoint cleared); or, in trip-planning, rejected by the reviewer. |
| 1 | Error. The board shows `STOPPED` with the reason `Workflow error: <message>` (the run log records `FAILED`) and the checkpoint is kept, so a re-run with the same inputs resumes. |
| 2 | Emergency STOP ALL. The board shows `STOPPED` and the checkpoint is cleared. |

A run stopped by the budget guard also exits 0: read the console or the board banner.

## Examples

| Example | Topology | Demonstrates | Tools |
|---------|----------|--------------|-------|
| [resume-creation](resume-creation/) | Sequential 2-agent | The minimal "hello world" port — analyze → write | — |
| [trip-planning](trip-planning/) | Sequential 3-agent + HITL | Pipeline hand-off, checkpoint/resume, human approval | Tavily / Serper (optional) |
| [social-media-team](social-media-team/) | **Heterogeneous fan-out / fan-in** | 1 → 4 parallel composers → join (`waitAll`), partial-failure tolerance | — |
| [rag-knowledge-base](rag-knowledge-base/) | Single agent + retrieval tool | Real RAG (`SimpleRAG`) inside a distributed actor | `@kaibanjs/tools` SimpleRAG (needs OpenAI key) |

Only trip-planning has a human review step. Decide in the orchestrator terminal, or on the core repo's
React board ([how to run it](https://github.com/andreibesleaga/kaiban-distributed#react-board-board));
`viewer/board.html` is read-only. Details: [trip-planning/README.md](trip-planning/README.md).
Each example README ends with a table of its inputs, timeouts and `WORKFLOW_ID`.

## Prerequisites

- Node.js ≥ 22, Docker (for Redis/Kafka + the containerised stacks)
- This repo needs `kaiban-distributed` ^2.1.2 (see `package.json`).
- An LLM key: `OPENAI_API_KEY` **or** `OPENROUTER_API_KEY` (or a local
  OpenAI-compatible endpoint via `OPENAI_BASE_URL`, together with `OPENAI_API_KEY` set to any non-empty value such as `ollama`)
- Optional per-example tool keys (see each example's README): `TAVILY_API_KEY`,
  `SERPER_API_KEY`. The RAG example needs `OPENAI_API_KEY` for embeddings.

## Quick start

```bash
npm install
cp .env.example .env            # add your OPENAI_API_KEY (or OPENROUTER_API_KEY)

# Fully containerised run of one example (redis + gateway + per-agent workers):
docker compose -f trip-planning/docker-compose.yml --env-file .env up -d --build
docker compose -f trip-planning/docker-compose.yml --env-file .env run --rm orchestrator

# Watch the live Kanban board:
#   open viewer/board.html in a browser (it connects to the gateway on :3000)
```

`--env-file .env` on the `run` line matters: Compose reads `.env` from the folder of the first
`-f` file, not from the repo root, so without it the budget and input variables in `.env` are ignored.
`MAX_WORKFLOW_COST_USD` / `MAX_WORKFLOW_TOKENS` take a number or the literal `unlimited`; `0` is not
"unlimited".
The cap counts the spend of the current process: after a crash, a resumed run starts counting from zero
(phases restored from the checkpoint are not charged again), so the total across restarts can exceed it.
Workers also enforce the runtime's per-agent and per-task token caps (`MAX_TOKEN_BUDGET` 200000 and
`MAX_TASK_TOKEN_BUDGET` 50000 by default; the literal `unlimited` removes a cap). A long run can hit
them and look like a hang: the task is dead-lettered. Set them in `.env`; the compose files pass them to every worker.

Or use the helper script:

```bash
./scripts/run-example.sh start trip-planning            # BullMQ
./scripts/run-example.sh start trip-planning --kafka    # Kafka
./scripts/run-example.sh stop  trip-planning
./scripts/run-example.sh stop  trip-planning --kafka    # stop the same variant you started
```

`--kafka` works only for `trip-planning` and `social-media-team`, the two examples that have a
`docker-compose.kafka.yml`. `stop` runs `docker compose down -v`; the compose files define no
Redis volume, so any saved checkpoints are lost with the container.

## Local-dev path (no example containers)

Bring up just Redis + the gateway, then run workers/orchestrators with `ts-node`:

```bash
docker compose -f docker-compose.infra.yml --env-file .env up -d --build
# each worker in its own terminal (example: trip-planning)
npx ts-node trip-planning/city-selector-node.ts
npx ts-node trip-planning/local-expert-node.ts
npx ts-node trip-planning/concierge-node.ts
# then drive it
npx ts-node trip-planning/orchestrator.ts
```

The orchestrator degrades gracefully if the gateway is down — the workflow still
completes; you just don't get the board.

## How a port is structured (the recipe)

Every example follows the same shape — copy it to add a new one:

```
<example>/
  team-config.ts     # agents as KaibanJS IAgentParams + queue names + tool wiring
  roster.ts          # agents shown on the board (no tools built, so the orchestrator stays light; trip-planning, rag-knowledge-base)
  <role>-node.ts     # one worker per agent: startAgentNode({...})
  phases.ts          # per-phase: dispatchToAgent → router.wait / waitAll → forward context
  orchestrator.ts    # CompletionRouter + WorkflowOrchestrator (checkpoint) + budget + board + HITL
  docker-compose.yml # redis + gateway + one container per agent + cli-only orchestrator
  docker-compose.kafka.yml
  README.md
```

Shared building blocks live in [`shared/`](shared/) (table in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#shared-code)). Everything else is imported from
the published package:

```ts
import { startAgentNode, CompletionRouter, WorkflowOrchestrator,
         RedisCheckpointStore, dispatchToAgent, waitForHITLDecision,
         workflowBudgetFromEnv, buildLLMConfig, createDriver } from "kaiban-distributed/shared";
import type { KaibanAgentConfig, IMessagingDriver } from "kaiban-distributed";
```

Attaching a tool is just adding it to the agent's `tools` array — the distributed
handler runs it unchanged because `KaibanAgentConfig` is KaibanJS's full
`IAgentParams`:

```ts
import { TavilySearchResults } from "@kaibanjs/tools/tavily";
const agent: KaibanAgentConfig = {
  name: "Peter Atlas", role: "City Selector", goal: "...",
  tools: [new TavilySearchResults({ apiKey: process.env.TAVILY_API_KEY!, maxResults: 5 })],
};
```

## Deployment

Each example is **not one web service** — it's a set of **long-lived, stateful actor
processes** that share a message bus: a **gateway** (HTTP + Socket.io board + A2A +
`/health`), **one worker process per agent** (each consuming its queue
`kaiban-agents-<id>`), a short-lived **orchestrator**, and the static **board**
(`viewer/board.html`). One Docker image ([`Dockerfile`](Dockerfile)) serves every role —
the role is chosen by the container's start `command` and a few env vars (`ROLE`/`AGENT_IDS`
for the gateway, `AGENT_ID` for a worker). Transport is **Redis/BullMQ** (default) or
**Kafka**, but **Redis is always required** (see [DEPLOYMENT.md](DEPLOYMENT.md), section 0). The rule everywhere: **one process per agent, always-on** —
workers are queue consumers, so don't put them on scale-to-zero serverless.

| Target | Fit / how |
|--------|-----------|
| **Local** | `docker compose -f <example>/docker-compose.yml --env-file .env up` (Redis + gateway + per-agent workers), or the ts-node dev path with `docker-compose.infra.yml`. |
| **Railway** | Easiest always-on fit: one service per role from the Dockerfile (override start command), Redis plugin → `REDIS_URL`, keys in secrets. |
| **Vercel\*** | Serverless does **not** fit the gateway or workers. Use it only for the **static board** and/or a thin "trigger a run" API against managed Redis (Upstash); run gateway + workers on an always-on host. |
| **AWS** | ECS/Fargate, one service per role + ElastiCache (Redis) or MSK (Kafka). Simpler: EC2 + docker compose. k8s: EKS. |
| **Azure** | Container Apps, one app per role with **`min-replicas ≥ 1`** + Azure Cache for Redis (or Event Hubs Kafka). Alt: AKS. |
| **GCP** | Cloud Run for the gateway; for workers you **must** set `--min-instances=1` + CPU always-allocated (no scale-to-zero), or use GKE/VM + Memorystore. |
| **Kubernetes** | One image, a Deployment per role with `ROLE`/`AGENT_ID` env; Redis/Kafka managed or in-cluster; HPA only for competing-consumer agents. |
| **Multi-device SLM swarm ⭐** | The differentiator: each agent runs on a **separate device** against one shared Redis (LAN/VPN/Tailscale) and a **local small model** via `OPENAI_BASE_URL` (Ollama/vLLM/LM Studio) — e.g. an 8B writer on a workstation, a 3B analyst on a laptop, a 1B classifier on a Pi. Heterogeneous, private, offline-capable (the agents; the board needs the Socket.io script, see DEPLOYMENT.md), near-zero inference cost. |

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for concrete per-target steps, env, diagrams, and caveats.
For how one example is wired (files, queues, checkpoints, board), see
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**; contributors and coding agents start with
**[AGENTS.md](AGENTS.md)**.

## Verification status

- GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, `npm run typecheck`, `npm test` and
  `npm run build` on Node 22 for every push and pull request to `main`. The 26 tests are deterministic
  (no Redis, no network, no key): they cover the shared helpers, the run-end and compose-phase failure
  paths, and the compose and orchestrator wiring.
- Nothing in CI starts Redis, a worker or an LLM call. A full run needs your own LLM key (and tool keys
  where noted); run any example's orchestrator to exercise the whole pipeline and the board.

## Appendix A — Upstream example feasibility (porting backlog)

The four shipped examples are the easy, high-value ports. The rest of the
[upstream KaibanJS examples](https://www.kaibanjs.com/examples) map onto this runtime as
follows — same recipe, more agents:

| Upstream example | Topology | Port tier | Notes |
|---|---|---|---|
| **Resume Creation** | 2, sequential | ✅ shipped | — |
| **Trip Planning** | 3, sequential | ✅ shipped | — |
| Company Research | 6–7 → compiler | Easy | Larger fan-out/fan-in (search tool) |
| **GitHub Social Media Team** | 1→4→1 fan-out/in | ✅ shipped | — |
| Airline Re-accommodation / Seat Upsell / Revenue Mgmt | 4–6 pipeline | Medium | Pure reasoning; domain-heavy |
| **RAG Product Knowledge Base** | 1 + tool | ✅ shipped | — |
| Conference Audio Analysis | 4, sequential | Medium | Audio input may exceed the 64 KB message cap |
| A2A Protocol Integration | — | Skip | Redundant — the runtime already ships A2A federation |
| Kaiban-Platform / MCP-card / OpenClaw / Claude-Code demos | — | Skip | Coupled to hosted platforms or external CLIs |
| WorkflowDriven & ReactChampion | mixed agent classes | Defer | Needs bridge support for special agent types |

## Appendix B — `@kaibanjs/tools` quick reference

Subpath import per tool, construct with its key, attach via the agent `tools` array:

`@kaibanjs/tools/{tavily,serper,exa,firecrawl,`
`jina-url-to-markdown,pdf-search,simple-rag,simple-rag-retrieve,website-search,`
`textfile-search,wolframalpha,zapier-webhook,make-webhook}`

`GithubIssues` is not available as a subpath in `@kaibanjs/tools` 0.8.0; import it from the package
root: `import { GithubIssues } from "@kaibanjs/tools"`.

## License

GPL-3.0-or-later (example/app code), depending on the Apache-2.0 published
`kaiban-distributed` core. Core source is not vendored here.

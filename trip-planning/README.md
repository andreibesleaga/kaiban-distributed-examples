# Trip Planning — distributed sequential pipeline

Port of the KaibanJS [Multi-Agent Trip Planning](https://www.kaibanjs.com/examples)
example onto the `kaiban-distributed` actor model. Three agents, each running as
its **own worker process**, hand work down a sequential pipeline:

```
Peter Atlas  ──▶  Sophia Lore   ──▶  Maxwell Journey  ──▶  Human (HITL)
City Selector     Local Expert       Travel Concierge      Approve / Revise / Reject
   (search)         (search)           (synthesis)
```

- **City Selector** and **Local Expert** use a live web-search tool
  ([Tavily](https://tavily.com) if `TAVILY_API_KEY` is set, else
  [Serper](https://serper.dev) if `SERPER_API_KEY` is set, else the model reasons
  without search).
- **Concierge** assembles the final day-by-day itinerary.
- Each phase is **checkpointed in Redis** — a crashed run restarted with the same
  inputs resumes from the last completed phase.
- A **human approval gate** (HITL) ends the run; REVISE re-runs the concierge with
  your notes.

**STOP ALL:** with `CONTROL_PLANE_ENABLED=true` (see the [root README](../README.md#emergency-stop-all)) a stop ends this run `STOPPED`, clears its checkpoint and exits with code 2.

**Human review.** Answer the prompt in the orchestrator terminal, or use the buttons on the core repo's React board ([how to run it](https://github.com/andreibesleaga/kaiban-distributed#react-board-board)); `viewer/board.html` is read-only. In the terminal `[1] APPROVE` is the same decision as `PUBLISH` on the React board and in `VALID_HITL_DECISIONS`; `VIEW` is terminal-only. A STOP ALL ends the review wait.

## Run it (fully containerised)

```bash
# from the repo root:
cp .env.example .env            # set OPENAI_API_KEY (or OPENROUTER) + optionally TAVILY_API_KEY
docker compose -f trip-planning/docker-compose.yml --env-file .env up -d --build
docker compose -f trip-planning/docker-compose.yml --env-file .env run --rm orchestrator
# watch the live Kanban: open viewer/board.html in a browser
```

Customise the trip with env vars (compose reads them, or pass inline to the orchestrator):

```bash
ORIGIN="Berlin" DATES="first week of October" \
INTERESTS="food, history, live jazz" BUDGET="1500 EUR" \
docker compose -f trip-planning/docker-compose.yml --env-file .env run --rm orchestrator
```

Kafka transport instead of Redis/BullMQ:

```bash
docker compose -f trip-planning/docker-compose.kafka.yml --env-file .env up -d --build
docker compose -f trip-planning/docker-compose.kafka.yml --env-file .env run --rm orchestrator
```

## Run it (local dev, no example containers)

```bash
# 1. infra + gateway only
AGENT_IDS=city-selector,local-expert,concierge docker compose -f docker-compose.infra.yml --env-file .env up -d --build
# 2. each worker in its own terminal
npx ts-node trip-planning/city-selector-node.ts
npx ts-node trip-planning/local-expert-node.ts
npx ts-node trip-planning/concierge-node.ts
# 3. drive it
ORIGIN="Tokyo" INTERESTS="temples, ramen" npx ts-node trip-planning/orchestrator.ts
```

## Files

| File | Role |
|------|------|
| `team-config.ts` | The 3 agents (`IAgentParams`) + queue names + search-tool wiring |
| `*-node.ts` | One worker per agent (`startAgentNode`) |
| `phases.ts` | Per-phase dispatch → wait → forward-context |
| `orchestrator.ts` | Checkpointed pipeline + budget guard + board + HITL |
| `docker-compose.yml` / `.kafka.yml` | Full multi-node stack (BullMQ / Kafka) |

## Orchestrator settings

Every variable below is optional. Compose reads it from `.env` (`--env-file .env`) or from the
shell; an empty value counts as unset.

| Variable | Default | Meaning |
|----------|---------|---------|
| `ORIGIN` | `New York` | Where the trip starts. |
| `DATES` | `a long weekend next month` | When. |
| `INTERESTS` | `history, food, and architecture` | What the traveller likes. |
| `BUDGET` | `1500 USD` | Trip budget. |
| `CITY_WAIT_MS` | `120000` | Time allowed for city selection. |
| `EXPERT_WAIT_MS` | `180000` | Time allowed for local insights. |
| `PLAN_WAIT_MS` | `240000` | Time allowed for the itinerary. |
| `WORKFLOW_ID` | `trip-` plus the first 16 hex characters of the SHA-256 of the four trip inputs | Checkpoint key. A re-run with the same value resumes; set a different value to start a fresh run on the same inputs. |

The spend caps (`MAX_WORKFLOW_COST_USD`, `MAX_WORKFLOW_TOKENS`) are in the [root README](../README.md#quick-start).

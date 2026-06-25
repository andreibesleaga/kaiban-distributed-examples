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

## Run it (fully containerised)

```bash
cp ../.env.example ../.env     # set OPENAI_API_KEY (or OPENROUTER) + optionally TAVILY_API_KEY
# from the repo root:
docker compose -f trip-planning/docker-compose.yml --env-file .env up -d --build
docker compose -f trip-planning/docker-compose.yml run --rm orchestrator
# watch the live Kanban: open viewer/board.html in a browser
```

Customise the trip with env vars (compose reads them, or pass inline to the orchestrator):

```bash
ORIGIN="Berlin" DATES="first week of October" \
INTERESTS="food, history, live jazz" BUDGET="1500 EUR" \
docker compose -f trip-planning/docker-compose.yml run --rm orchestrator
```

Kafka transport instead of Redis/BullMQ:

```bash
docker compose -f trip-planning/docker-compose.kafka.yml --env-file .env up -d --build
docker compose -f trip-planning/docker-compose.kafka.yml run --rm orchestrator
```

## Run it (local dev, no example containers)

```bash
# 1. infra + gateway only
docker compose -f docker-compose.infra.yml --env-file .env up -d --build
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

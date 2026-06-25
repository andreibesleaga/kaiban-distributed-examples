# Resume Creation — minimal distributed sequential pipeline

Port of the KaibanJS [Multi-Agent Resume Creation](https://www.kaibanjs.com/examples)
example onto `kaiban-distributed`. The **simplest** example in this repo — a great
"hello world" for the distributed actor pattern. Two agents, each its own worker
process, in a straight line:

```
Mary  ──▶  Alex Mercer  ──▶  resume
Profile     Resume Writer
Analyst
```

- **Mary** extracts a structured professional profile from raw candidate notes.
- **Alex Mercer** writes a concise, ATS-friendly one-page resume from that profile.
- Pure LLM reasoning — **no tools, no HITL**. Runs with just an LLM key.
- Each phase is checkpointed in Redis (crash → resume).

## Run it (fully containerised)

```bash
cp ../.env.example ../.env     # set OPENAI_API_KEY (or OPENROUTER_API_KEY)
docker compose -f resume-creation/docker-compose.yml --env-file .env up -d --build
docker compose -f resume-creation/docker-compose.yml run --rm orchestrator
# watch the live Kanban: open viewer/board.html
```

Use your own candidate notes:

```bash
CANDIDATE="$(cat my-notes.txt)" \
  docker compose -f resume-creation/docker-compose.yml run --rm orchestrator
```

## Run it (local dev)

```bash
docker compose -f docker-compose.infra.yml --env-file .env up -d --build
npx ts-node resume-creation/analyst-node.ts
npx ts-node resume-creation/writer-node.ts
npx ts-node resume-creation/orchestrator.ts
```

## Files

| File | Role |
|------|------|
| `team-config.ts` | The 2 agents (`IAgentParams`) + queue names |
| `analyst-node.ts` / `writer-node.ts` | One worker per agent (`startAgentNode`) |
| `phases.ts` | analyze → write |
| `orchestrator.ts` | Checkpointed 2-phase pipeline + budget guard + board |
| `docker-compose.yml` | Redis + gateway + 2 workers + orchestrator |

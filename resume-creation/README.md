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
cp .env.example .env            # from the repo root; set OPENAI_API_KEY (or OPENROUTER_API_KEY)
docker compose -f resume-creation/docker-compose.yml --env-file .env up -d --build
docker compose -f resume-creation/docker-compose.yml --env-file .env run --rm orchestrator
# watch the live Kanban: open viewer/board.html
```

Use your own candidate notes:

```bash
CANDIDATE="$(cat my-notes.txt)" \
  docker compose -f resume-creation/docker-compose.yml --env-file .env run --rm orchestrator
```

**STOP ALL:** with `CONTROL_PLANE_ENABLED=true` (see the [root README](../README.md#emergency-stop-all)) a stop ends this run `STOPPED`, clears its checkpoint and exits with code 2.

## Run it (local dev)

```bash
AGENT_IDS=analyst,writer docker compose -f docker-compose.infra.yml --env-file .env up -d --build
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

## Orchestrator settings

Every variable below is optional. Compose reads it from `.env` (`--env-file .env`) or from the
shell; an empty value counts as unset.

| Variable | Default | Meaning |
|----------|---------|---------|
| `CANDIDATE` | a built-in sample profile | The candidate notes to turn into a resume. |
| `ANALYZE_WAIT_MS` | `120000` | Time allowed for the profile analysis. |
| `WRITE_WAIT_MS` | `180000` | Time allowed for writing the resume. |
| `WORKFLOW_ID` | `resume-` plus the first 16 hex characters of the SHA-256 of the candidate notes | Checkpoint key. A re-run with the same value resumes; set a different value to start a fresh run on the same inputs. |

The spend caps (`MAX_WORKFLOW_COST_USD`, `MAX_WORKFLOW_TOKENS`) are in the [root README](../README.md#quick-start).

# GitHub Release Social Media Team — distributed fan-out / fan-in

Port of the KaibanJS [GitHub Release Social Media Team](https://www.kaibanjs.com/examples)
example onto `kaiban-distributed`. It demonstrates a **heterogeneous
fan-out / fan-in** topology — distinct from the core `global-research` example,
which fans out *identical* search tasks. Here one input fans out to **four
different** composer agents running in parallel:

```
                  ┌──▶ Sparrow  (Tweet/X)  ──┐
ContentExtractor ─┤──▶ Lincoln  (LinkedIn) ──┤
   (Quill)        ├──▶ Dot      (Discord)  ──┤──▶ ResultAggregator (Mosaic)
                  └──▶ Beacon   (Blog)     ──┘
```

- The extractor distills raw release notes into shareable highlights.
- The four composers each run as their **own worker process** (one shared
  `composer-node.js` image selected by `AGENT_ID`) and execute **concurrently** —
  wall-clock is the slowest composer, not the sum.
- The fan-in uses `CompletionRouter.waitAll`, which is **partial-failure
  tolerant**: if one composer fails, the others still produce drafts and the
  aggregator notes the gap.
- The aggregator joins all four into one copy-paste-ready content pack.

No HITL — this is an automated content pipeline. Each phase is checkpointed in
Redis, so a crash mid-run resumes from the last completed phase.

## Run it (fully containerised)

```bash
cp .env.example .env            # from the repo root; set OPENAI_API_KEY (or OPENROUTER)
docker compose -f social-media-team/docker-compose.yml --env-file .env up -d --build
PROJECT="my-project" RELEASE_NOTES="$(cat path/to/your/CHANGELOG.md)" \
  docker compose -f social-media-team/docker-compose.yml --env-file .env run --rm orchestrator
# watch the live Kanban: open viewer/board.html
```

Kafka transport:

```bash
docker compose -f social-media-team/docker-compose.kafka.yml --env-file .env up -d --build
docker compose -f social-media-team/docker-compose.kafka.yml --env-file .env run --rm orchestrator
```

**STOP ALL:** with `CONTROL_PLANE_ENABLED=true` (see the [root README](../README.md#emergency-stop-all)) a stop ends this run `STOPPED`, clears its checkpoint and exits with code 2.

A composer that fails does not sink the run (the aggregator notes the gap), but if **all four** fail the run ends FAILED and nothing is checkpointed.

## Run it (local dev)

```bash
AGENT_IDS=extractor,tweet,linkedin,discord,blog,aggregator docker compose -f docker-compose.infra.yml --env-file .env up -d --build
# start the 6 workers (each in its own terminal):
npx ts-node social-media-team/extractor-node.ts
AGENT_ID=tweet    npx ts-node social-media-team/composer-node.ts
AGENT_ID=linkedin npx ts-node social-media-team/composer-node.ts
AGENT_ID=discord  npx ts-node social-media-team/composer-node.ts
AGENT_ID=blog     npx ts-node social-media-team/composer-node.ts
npx ts-node social-media-team/aggregator-node.ts
# drive it:
PROJECT="kaiban-distributed" npx ts-node social-media-team/orchestrator.ts
```

## Extending

The extractor currently takes release notes as text. To pull them automatically,
attach the `GithubIssues` tool (`import { GithubIssues } from "@kaibanjs/tools"`; there is no `@kaibanjs/tools/github-issues` subpath in 0.8.0) to the extractor config (it needs
a GitHub token) and instruct it to summarise the latest release — the rest of the
pipeline is unchanged.

## Files

| File | Role |
|------|------|
| `team-config.ts` | Extractor + 4 composer configs (`COMPOSERS`) + aggregator |
| `extractor-node.ts` / `aggregator-node.ts` | The single-instance endpoints |
| `composer-node.ts` | One generic composer node; `AGENT_ID` picks the platform |
| `phases.ts` | extract → **fan-out + `waitAll`** → aggregate |
| `orchestrator.ts` | Checkpointed fan-out/fan-in driver + budget guard + board |
| `docker-compose.yml` / `.kafka.yml` | Full 6-worker stack (BullMQ / Kafka) |

## Orchestrator settings

Every variable below is optional. Compose reads it from `.env` (`--env-file .env`) or from the
shell; an empty value counts as unset.

| Variable | Default | Meaning |
|----------|---------|---------|
| `PROJECT` | `Kaiban-Distributed` | Project name used in the posts. |
| `RELEASE_NOTES` | a built-in sample | The release notes to turn into posts. |
| `EXTRACT_WAIT_MS` | `120000` | Time allowed for the extraction. |
| `COMPOSE_WAIT_MS` | `180000` | Time allowed for the four composers together. |
| `AGGREGATE_WAIT_MS` | `180000` | Time allowed for the aggregation. |
| `WORKFLOW_ID` | `social-` plus the first 16 hex characters of the SHA-256 of the project name and the release notes | Checkpoint key. A re-run with the same value resumes; set a different value to start a fresh run on the same inputs. |

The spend caps (`MAX_WORKFLOW_COST_USD`, `MAX_WORKFLOW_TOKENS`) are in the [root README](../README.md#quick-start).

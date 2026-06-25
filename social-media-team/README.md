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
cp ../.env.example ../.env     # set OPENAI_API_KEY (or OPENROUTER)
docker compose -f social-media-team/docker-compose.yml --env-file .env up -d --build
PROJECT="my-project" RELEASE_NOTES="$(cat CHANGELOG.md)" \
  docker compose -f social-media-team/docker-compose.yml run --rm orchestrator
# watch the live Kanban: open viewer/board.html
```

Kafka transport:

```bash
docker compose -f social-media-team/docker-compose.kafka.yml --env-file .env up -d --build
docker compose -f social-media-team/docker-compose.kafka.yml run --rm orchestrator
```

## Run it (local dev)

```bash
docker compose -f docker-compose.infra.yml --env-file .env up -d --build
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
attach the `@kaibanjs/tools/github-issues` tool to the extractor config (it needs
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

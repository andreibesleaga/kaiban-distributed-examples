# RAG Product Knowledge Base — distributed retrieval-augmented agent

Port of the KaibanJS [AI Agent with RAG: Product Knowledge Base](https://www.kaibanjs.com/examples)
example onto `kaiban-distributed`. It demonstrates the one capability neither core
example shows: a real **retrieval tool** wired into a distributed actor.

```
Question ──▶ Iris (Product Specialist)  ──▶ grounded answer
                 └─ SimpleRAG tool (embeddings + in-memory vector store
                    over the embedded product knowledge base)
```

The specialist answers questions about a fictional **Nimbus T3 smart thermostat**
using the `@kaibanjs/tools` `SimpleRAG` tool. Retrieval happens **inside** the
tool — the corpus is embedded and indexed there — so only the question and the
final answer cross the messaging caps (no large-document transfer). Answers are
grounded in [`knowledge.ts`](knowledge.ts), so it's obvious when the agent is
retrieving facts versus guessing.

> **Requires `OPENAI_API_KEY`.** `SimpleRAG` uses OpenAI embeddings + synthesis,
> even if your chat LLM is OpenRouter or local. Set `OPENAI_API_KEY` (or a
> dedicated `RAG_OPENAI_API_KEY`). Without a key the agent still runs but skips
> retrieval (answers won't be grounded).

## Run it (fully containerised)

```bash
cp ../.env.example ../.env     # set OPENAI_API_KEY
docker compose -f rag-knowledge-base/docker-compose.yml --env-file .env up -d --build
docker compose -f rag-knowledge-base/docker-compose.yml run --rm orchestrator
# watch the live Kanban: open viewer/board.html
```

Ask your own questions (|| separated):

```bash
QUESTIONS="Do I need a C-wire?||What voice assistants are supported?" \
  docker compose -f rag-knowledge-base/docker-compose.yml run --rm orchestrator
```

Use your own corpus instead of the Nimbus T3 KB:

```bash
RAG_CONTENT="$(cat my-product-docs.md)" \
  docker compose -f rag-knowledge-base/docker-compose.yml run --rm orchestrator
```

## Run it (local dev)

```bash
docker compose -f docker-compose.infra.yml --env-file .env up -d --build
npx ts-node rag-knowledge-base/specialist-node.ts
npx ts-node rag-knowledge-base/orchestrator.ts
```

## Files

| File | Role |
|------|------|
| `knowledge.ts` | The embedded product knowledge base (compiled in; override via `RAG_CONTENT`) |
| `team-config.ts` | The Product Specialist agent + `SimpleRAG` tool wiring |
| `specialist-node.ts` | The specialist worker (`startAgentNode`) |
| `phases.ts` | One dispatch → retrieve → answer |
| `orchestrator.ts` | Checkpointed Q&A batch + budget guard + board |
| `docker-compose.yml` | Redis + gateway + specialist + orchestrator |

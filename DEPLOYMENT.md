# Deployment

This repo is **not a single app** — each example is a set of **long-lived, stateful
actor processes** built on the [`kaiban-distributed`](https://github.com/andreibesleaga/kaiban-distributed)
runtime. The deployment story is therefore "run N small always-on processes that share
a message bus", not "deploy one web service". Everything below follows from that.

## 0. What you actually deploy

One Docker image (the repo [`Dockerfile`](Dockerfile)) serves **every** role; the role is
chosen by the container's start `command`:

| Role | Start command | Notes |
|------|---------------|-------|
| **gateway** | `node node_modules/kaiban-distributed/dist/src/main/index.js` | HTTP + Socket.io board + A2A + `/health` on `PORT` (3000). Env: `ROLE=gateway`, `AGENT_IDS=<the worker agent ids>` (the gateway runs no agents; its agent card advertises one skill per id). |
| **worker node** (one per agent) | `node dist/<example>/<role>-node.js` | Consumes its own queue `kaiban-agents-<AGENT_ID>`. Env: `AGENT_ID=<id>` (a label: each worker file fixes its own id and queue). **One process per agent.** |
| **orchestrator** | `node dist/<example>/orchestrator.js` | Drives the workflow; short-lived. HITL examples (e.g. trip-planning) need a **TTY** (`stdin_open`/`tty`). |
| **board** | static `viewer/board.html` + `viewer/board.js` | Connects to the gateway named in the `?gateway=<url>` query param. To fix the URL in the page instead, see §4. |

**Transport:** Redis/BullMQ (default, `MESSAGING_DRIVER=bullmq`) **or** Kafka
(`MESSAGING_DRIVER=kafka` + `KAFKA_BROKERS`).
**Redis is ALWAYS required** — even on Kafka, the live board state (`kaiban-state-events`),
the HITL decisions (`kaiban-hitl-decisions`), the STOP ALL channel (`kaiban-control`) and the
checkpoints use Redis. State, HITL and control channels are Redis pub/sub in both transports.

### Core env vars

Names, defaults and meaning: [`.env.example`](.env.example) and each example's README (inputs and timeouts). Below: what is deployment-specific.

```bash
# Transport
MESSAGING_DRIVER=bullmq            # bullmq (Redis) | kafka
REDIS_URL=redis://host:6379        # ALWAYS required
KAFKA_BROKERS=host:9092            # only when MESSAGING_DRIVER=kafka

# Gateway
PORT=3000
ROLE=gateway                       # gateway role only
AGENT_IDS=city-selector,local-expert,concierge   # gateway role only: the worker agent ids of the example (trip-planning shown)
GATEWAY_URL=http://gateway:3000    # orchestrator → gateway

# Worker
AGENT_ID=city-selector             # compose / Kubernetes label only: each worker file fixes its own id and queue.
                                   # Do not put it in a shared .env. Only composer-node.js (social-media-team) reads it.

# Orchestrator (optional)
WORKFLOW_ID=my-run                 # checkpoint key; default = prefix + hash of the run inputs (compose passes it from .env)
CITY_WAIT_MS=120000                # per-phase timeout; names and defaults: the table at the end of each example's README
                                   # (the compose files pass them to the orchestrator)

# LLM (choose one provider)
OPENAI_API_KEY=...                 # standard OpenAI
# OPENROUTER_API_KEY=...           # takes priority over OPENAI_API_KEY if set
# OPENAI_BASE_URL=http://host:11434/v1   # any OpenAI-compatible server (Ollama/vLLM/LM Studio);
#                                        # read only together with OPENAI_API_KEY=<any non-empty value, e.g. ollama>
LLM_MODEL=gpt-4o-mini

# Tools (per example) / spend guard
TAVILY_API_KEY=  SERPER_API_KEY=   # web search (trip-planning)
MAX_WORKFLOW_COST_USD=0.50  MAX_WORKFLOW_TOKENS=unlimited   # a number, or the literal `unlimited`; 0 does not mean unlimited

# Emergency STOP ALL — see README "Emergency STOP ALL"
CONTROL_PLANE_ENABLED=true         # on EVERY process: gateway, workers, orchestrator
BOARD_JWT_SECRET=...               # gateway: signs board tokens; the viewer reads one from `board.html#token=`
```

> RAG (`rag-knowledge-base`) also needs an OpenAI key for embeddings: see its README.

## Before exposing the gateway

The stock compose files publish the gateway on `:3000` on all interfaces and start it with no
authentication. In that state anyone who can reach it can send A2A `message/send` requests (which
dispatch to your workers and spend your LLM key) and HITL decisions over Socket.io. Before you give
the gateway a public domain, a load balancer or a LAN address, set these on the gateway:

| Variable | Why |
|----------|-----|
| `A2A_JWT_SECRET` | Turns on JWT authentication for the A2A endpoints. Unset = authentication off. |
| `BOARD_JWT_SECRET` | Requires a board token for the Socket.io handshake (the board shows nothing without one) and for STOP ALL. The viewer reads the token from `viewer/board.html#token=<token>`; the README, "Emergency STOP ALL", shows how to create one. |
| `SOCKET_CORS_ORIGINS` | The origins allowed to open the board socket (comma-separated). |
| `NODE_ENV=production` | With it, the gateway refuses to start unless `BOARD_JWT_SECRET`, `A2A_JWT_SECRET` and `CHANNEL_SIGNING_SECRET` are all set, each at least 32 bytes and all three different. It also refuses a wildcard CORS origin, so `SOCKET_CORS_ORIGINS` becomes required. Any worker or orchestrator that has `NODE_ENV=production` and `CONTROL_PLANE_ENABLED` also needs `CHANNEL_SIGNING_SECRET`. The image does not set it. |
| `CHANNEL_SIGNING_SECRET` | Signs the state, HITL and control channels. Use the same value on every service. It must differ from the other two secrets. |
| `TRUST_PROXY=true` | Set it behind Railway, an ALB, an ingress or Nginx, so per-client rate limits see the client address and not the proxy. Only when the gateway is reachable through that proxy alone (bind port 3000 to the private network or `127.0.0.1`; the shipped compose files publish it on every interface) and the proxy sets `X-Forwarded-For` itself; otherwise a direct caller can forge the header and dodge the per-client limits. |
| `A2A_PUBLIC_URL` | The gateway's public HTTPS URL; it goes into the agent card (default `http://localhost:3000`). |

Make three separate secrets, for example:

```bash
for v in BOARD_JWT_SECRET A2A_JWT_SECRET CHANNEL_SIGNING_SECRET; do echo "$v=$(openssl rand -base64 32)"; done
```

The compose files pass all of these from `.env` to the gateway (and the signing secret and control-plane flag to every service); unset means the local defaults. They also pass the per-agent token caps (`MAX_TOKEN_BUDGET` 200000, `MAX_TASK_TOKEN_BUDGET` 50000, the runtime defaults) to every worker. On a platform, set all of these as service variables.

Redis and Kafka exposure (loopback binding, PLAINTEXT Kafka): see [SECURITY.md](SECURITY.md). A Redis
password or `rediss://` in `REDIS_URL` works for managed Redis (Railway, ElastiCache, Azure Cache, Upstash, Memorystore).

## 1. Topology recap

```mermaid
flowchart LR
  subgraph bus["Shared bus"]
    R[("Redis<br/>(always)<br/>BullMQ + board + HITL + STOP ALL + checkpoints")]
    K[("Kafka<br/>(optional transport)")]
  end
  ORCH["orchestrator<br/>(drives workflow, HITL/TTY)"] -->|dispatch| R
  ORCH -.->|kafka mode| K
  A1["worker: city-selector<br/>queue kaiban-agents-city-selector"] --- R
  A2["worker: local-expert"] --- R
  A3["worker: concierge"] --- R
  GW["gateway<br/>HTTP + Socket.io + A2A + /health"] --- R
  BOARD["board.html (static)"] -->|Socket.io| GW
  A1 -.-> K
  A2 -.-> K
  A3 -.-> K
```

**The rule: one OS process per agent.** Scaling, placement and the multi-device swarm
(§9) all follow from this. The orchestrator degrades gracefully if the gateway is down —
the workflow still completes, you just lose the live board.

## 2. Local

**When to use:** development, demos, trying an example end-to-end.

Run commands (containerised stack, Kafka variant, helper script, ts-node path): see the quick start
and the "Local-dev path" in the [README](README.md#quick-start), and each example's README.

Open `viewer/board.html` in a browser (connects to the gateway on `:3000`).

## 3. Railway

**When to use:** the easiest always-on host for this architecture — strong fit.

Railway runs one **service per role** from the same repo `Dockerfile`; you override the
**start command** per service and share env vars.

1. **Redis:** add the Railway **Redis** plugin → it exposes `REDIS_URL` to other services.
2. **gateway service:** deploy the Dockerfile; default `CMD` already runs the gateway.
   Set `AGENT_IDS=<worker ids>`, `PORT=3000`, `REDIS_URL`, LLM keys (`ROLE=gateway` is the default). Expose it
   (Railway gives a public HTTPS domain → use as the board's `?gateway=` URL). Read
   "Before exposing the gateway" above first: a public gateway has no authentication by default, and
   behind Railway's proxy it needs `TRUST_PROXY=true` and `A2A_PUBLIC_URL`.
3. **one worker service per agent:** same image, override start command, e.g.
   `node dist/trip-planning/city-selector-node.js`, set `AGENT_ID=city-selector` + LLM keys
   + `REDIS_URL`. Repeat for `local-expert`, `concierge`.
4. **orchestrator:** run it inside a Railway service or shell. `railway run <cmd>` runs on your own
   machine with the service variables injected: the plugin's private `REDIS_URL` does not resolve
   there (use `REDIS_PUBLIC_URL`, after `npm run build`). HITL examples
   need a TTY, so an interactive orchestrator is better triggered from a shell than as a
   background service.
5. Put LLM/tool keys in Railway **secrets**, not plaintext env.

Caveats: workers must stay **always-on** (they are queue consumers) — keep them off any
sleep/free-tier idle policy. Each agent = its own service, so a 3-agent example = Redis +
gateway + 3 workers.

## 4. Vercel

**When to use:** static board hosting and/or a thin "trigger a run" API — **not** the
gateway or workers.

Be honest: Vercel is serverless. It does **not** fit:
- long-lived **BullMQ/Kafka consumers** (workers need a persistent event loop),
- the **persistent Socket.io gateway** (stateful WebSocket server),
- Kafka consumer groups.

Realistic split:
- **Host the static board on Vercel** — deploy `viewer/` as static files; point it at your
  always-on gateway with `?gateway=https://your-gateway.example.com`. To fix the URL in the page, add a
  `<script src="config.js"></script>` (a file that sets `window.GATEWAY_URL`) before `board.js`; an inline
  script is blocked by the page's Content-Security-Policy.
- **(Optional) a thin trigger API** — a Vercel Function that enqueues "start a run" (publishes
  the initial message) to a **managed Redis** like **Upstash** (`REDIS_URL=rediss://...`).
- **gateway + workers belong on an always-on host** (Railway / Fargate / Container Apps /
  Cloud Run with min-instances ≥ 1 / a VM). Use Upstash/managed Redis as the shared bus so
  both the serverless trigger and the always-on workers talk to the same Redis.

## 5. AWS

**When to use:** you're already on AWS / want managed Redis or Kafka at scale.

Recommended — **ECS / Fargate**, one **service per role** (or one task definition per role):
- **gateway** service: the image's default command, port 3000 behind an ALB; `/health` as the
  target-group health check.
- **one worker service per agent**, command `node dist/<example>/<role>-node.js`,
  `AGENT_ID=<id>`. For competing-consumer agents you can scale `desiredCount > 1`.
- **orchestrator** as a one-off task (`aws ecs run-task`); HITL ones need an interactive
  session (ECS Exec) for the TTY.
- **Redis:** **ElastiCache for Redis** → `REDIS_URL`. **Kafka:** **MSK** → `KAFKA_BROKERS`,
  `MESSAGING_DRIVER=kafka` (Redis/ElastiCache still required, see section 0).
- Put LLM/tool keys in **Secrets Manager** / SSM Parameter Store and inject as task secrets.

Simpler alternative: a single **EC2** box running `docker compose -f <example>/docker-compose.yml --env-file .env up -d`
— same as Local, just remote. For Kubernetes, use **EKS** (see §8).

## 6. Azure

**When to use:** Azure-native always-on containers without managing a cluster.

Recommended — **Azure Container Apps**, one app per role:
- **gateway** app: default command, ingress enabled on port 3000.
- **one app per agent**, command `node dist/<example>/<role>-node.js`, `AGENT_ID=<id>`.
  Set **`min-replicas ≥ 1`** so consumers stay alive (Container Apps can scale to zero — that
  would kill your workers). KEDA scale rules can add replicas for competing-consumer agents.
- **Redis:** **Azure Cache for Redis** → `REDIS_URL`. **Kafka:** an **Event Hubs** Kafka
  endpoint → `KAFKA_BROKERS` (Redis still required, see section 0).
- Secrets via Container Apps secrets / Key Vault references.

Alternative: **AKS** (see §8).

## 7. GCP

**When to use:** Cloud Run for the gateway, with care for the workers.

- **gateway** on **Cloud Run** works well (request-driven HTTP + WebSocket; set min-instances
  ≥ 1 to avoid cold starts dropping board connections).
- **Workers on Cloud Run — critical caveat:** BullMQ/Kafka consumers are **not** request-driven;
  Cloud Run scales to zero and throttles CPU between requests, which **stops a consumer**. To run
  workers on Cloud Run you must:
  - `--min-instances=1` (one persistent instance per agent), and
  - **CPU always allocated** (no CPU throttling / no scale-to-zero),
  - `--max-instances=1` unless the agent is a safe competing consumer.

  Honestly, **GKE or a VM is a better home for the workers**; Cloud Run is cleanest for the
  gateway.
- **Redis:** **Memorystore for Redis** → `REDIS_URL`. Secrets via **Secret Manager**.
- Alternative: **GKE** (see §8).

## 8. Kubernetes / Helm

**When to use:** you already run k8s and want declarative, scalable placement.

One image, a **Deployment per role**, env-selected:

```yaml
# gateway
env: [{name: ROLE, value: gateway}, {name: AGENT_IDS, value: "city-selector,local-expert,concierge"},
      {name: PORT, value: "3000"}, {name: REDIS_URL, value: redis://redis:6379}]
command: ["node", "node_modules/kaiban-distributed/dist/src/main/index.js"]
# → Service + Ingress on 3000, readiness/liveness probe on /health

# worker (one Deployment per agent)
env: [{name: AGENT_ID, value: city-selector}, {name: REDIS_URL, value: redis://redis:6379},
      {name: OPENAI_API_KEY, valueFrom: {secretKeyRef: {name: kaiban-llm, key: openai}}}]
command: ["node", "dist/trip-planning/city-selector-node.js"]
```

- **Redis/Kafka:** managed (ElastiCache/Memorystore/MSK/Event Hubs) or in-cluster
  (Bitnami Redis/Strimzi Kafka). Redis always required.
- **Secrets** for LLM/tool keys; **ConfigMap** for `MESSAGING_DRIVER`, `LLM_MODEL`, broker addrs.
- **HPA** only on agents that are **competing consumers** (idempotent, order-independent work);
  a strictly-sequential agent should stay at `replicas: 1`.
- Orchestrator → a `Job` (or interactive `kubectl run -it` for HITL/TTY).

## 9. Multi-device / edge swarm with SLMs  ⭐ the differentiator

Because **every agent is an independent process that only needs the shared bus**, each agent can
run on a **separate physical device**, all pointing at **one shared Redis** (or Kafka) over
LAN / VPN / Tailscale. And because the LLM endpoint is just `OPENAI_BASE_URL` + `LLM_MODEL`,
**each device can run its agent against a LOCAL small language model (SLM)** — right-sizing the
model to the hardware.

This gives a **heterogeneous swarm**: a workstation runs a heavyweight writer on a 7–8B model,
a laptop runs an analyst on a 3B model, a Raspberry Pi / mini-PC runs a lightweight classifier on
a 1B model — all coordinated over the shared bus.

```mermaid
flowchart TB
  subgraph hub["Shared infra (one box / cloud)"]
    R[("Redis (LAN-bound, password in REDIS_URL / TLS)")]
    GW["gateway + board"]
  end
  subgraph ws["Workstation (RTX GPU)"]
    W["worker: concierge<br/>Ollama llama3.1:8b"]
  end
  subgraph lap["Laptop"]
    L["worker: local-expert<br/>Ollama qwen2.5:3b"]
  end
  subgraph pi["Raspberry Pi / mini-PC"]
    P["worker: city-selector<br/>Ollama llama3.2:1b"]
  end
  W <--> R
  L <--> R
  P <--> R
  GW --- R
```

**Worked example** — trip-planning, 3 agents on 3 devices, shared Redis at `192.168.1.10`,
each agent on a local Ollama:

```bash
# Shared box (192.168.1.10): Redis + gateway. The stock compose file binds Redis to 127.0.0.1 and sets no password,
# so for a shared box change the Redis port mapping to the box's LAN address AND set `requirepass` (see Networking & security).
docker compose -f docker-compose.infra.yml --env-file .env up -d   # :3000 on all interfaces; :6379 as you changed it

# Workstation — heavyweight writer on an 8B model
export REDIS_URL=redis://:s3cret@192.168.1.10:6379
export OPENAI_API_KEY=ollama                       # any non-empty value; the base URL is ignored without it
export OPENAI_BASE_URL=http://localhost:11434/v1   # local Ollama
export LLM_MODEL=llama3.1:8b
AGENT_ID=concierge node dist/trip-planning/concierge-node.js

# Laptop — analyst on a 3B model
export REDIS_URL=redis://:s3cret@192.168.1.10:6379
export OPENAI_API_KEY=ollama
export OPENAI_BASE_URL=http://localhost:11434/v1
export LLM_MODEL=qwen2.5:3b
AGENT_ID=local-expert node dist/trip-planning/local-expert-node.js

# Raspberry Pi / mini-PC — lightweight selector on a 1B model
export REDIS_URL=redis://:s3cret@192.168.1.10:6379
export OPENAI_API_KEY=ollama
export OPENAI_BASE_URL=http://localhost:11434/v1
export LLM_MODEL=llama3.2:1b
AGENT_ID=city-selector node dist/trip-planning/city-selector-node.js

# Drive it from any device on the network:
GATEWAY_URL=http://192.168.1.10:3000 node dist/trip-planning/orchestrator.js
```

Any OpenAI-compatible local server works: **Ollama** (`http://localhost:11434/v1`),
**llama.cpp** (`--server`), **LM Studio**, **vLLM**. Pick a model per device:
`llama3.2:1b`/`3b`, `qwen2.5:3b`, `phi3:mini` for small nodes; 7–8B on a GPU box.

**Networking & security:**
- Bind Redis to the LAN (not `0.0.0.0` on the open internet) and **set a Redis password**
  (carried in `REDIS_URL`: `redis://:password@host:6379`; there is no separate `REDIS_PASSWORD` variable); use **TLS** (`rediss://...`) for untrusted links.
- For devices across sites, use a **mesh VPN** (Tailscale / WireGuard) and point `REDIS_URL`
  at the mesh IP — no ports exposed publicly.
- Kafka works the same way (`MESSAGING_DRIVER=kafka`, `KAFKA_BROKERS=<lan-broker>`), but Redis
  is still required (section 0).

**Why it matters:**
- **Privacy** — data and inference stay on-device; nothing leaves the LAN.
- **Cost** — local SLMs replace per-token API spend.
- **Offline / edge** — agents, bus and orchestrator run with no internet once models are pulled. The static board loads its Socket.io client from cdn.socket.io; for a fully offline LAN, save that file next to `board.html` and change the script tag and the CSP `script-src` (`'self'` is enough).
- **Right-sizing** — each device runs the largest model it can, no more; the swarm's total
  capability is the sum of heterogeneous hardware, coordinated over one bus.

---

### Cross-cutting caveats

- **Stateful consumers:** workers are long-lived; never deploy them on serverless/scale-to-zero
  without a persistent-instance escape hatch (min-instances ≥ 1, CPU always allocated).
- **Redis is always required**, even in Kafka mode (section 0).
- **One process per agent** is the unit of deployment and scaling; only scale replicas for agents
  that are genuinely competing consumers.
- **HITL examples need a TTY** for the interactive orchestrator.
- **Behind any proxy, load balancer or ingress** (Railway, ALB, Container Apps, Cloud Run, k8s ingress, Nginx):
  set `TRUST_PROXY=true` and `A2A_PUBLIC_URL` on the gateway ("Before exposing the gateway").
- Keep LLM/tool keys in the platform's **secret store**, not plaintext env.

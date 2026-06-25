/**
 * Social Media Team Orchestrator — heterogeneous fan-out / fan-in.
 *
 *   ContentExtractor ──▶ [ Tweet | LinkedIn | Discord | Blog ] (parallel) ──▶ ResultAggregator
 *
 * No HITL — this is an automated content pipeline. Each phase is checkpointed,
 * so a crash mid-run resumes from the last completed phase.
 *
 * Usage (local, after starting the worker nodes + gateway):
 *   PROJECT="kaiban-distributed" RELEASE_NOTES="$(cat CHANGELOG.md)" \
 *     npx ts-node social-media-team/orchestrator.ts
 */
import "dotenv/config";
import { createHash, randomUUID } from "crypto";
import {
  createDriver,
  getDriverType,
  CompletionRouter,
  WorkflowOrchestrator,
  RedisCheckpointStore,
  workflowBudgetFromEnv,
  assertWithinBudget,
  BudgetExceededError,
  createLogger,
} from "kaiban-distributed/shared";
import { ExampleStatePublisher, roster } from "../shared/state-publisher";
import { RunLogger } from "../shared/run-logger";
import { connectGateway } from "../shared/gateway";
import { SOCIAL_AGENTS } from "./team-config";
import {
  runExtractPhase,
  runComposePhase,
  runAggregatePhase,
  type ExtractResult,
  type ComposedDraft,
} from "./phases";

const log = createLogger("SocialMediaTeam");

const GATEWAY_URL = process.env["GATEWAY_URL"] ?? "http://localhost:3000";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const PROJECT = process.env["PROJECT"] ?? "Kaiban-Distributed";
const RELEASE_NOTES =
  process.env["RELEASE_NOTES"] ??
  `v2.0.0 — Highlights:
- New distributed actor runtime with BullMQ and Kafka transports
- Real-time Kanban board over Socket.io
- Human-in-the-loop approval gates
- A2A v0.3 federation + MCP tool client
- Fix: correct per-task token + cost accounting`;

const WORKFLOW_ID =
  process.env["WORKFLOW_ID"] ??
  `social-${createHash("sha256").update(`${PROJECT}:${RELEASE_NOTES}`).digest("hex").slice(0, 16)}`;

async function main(): Promise<void> {
  const isKafka = getDriverType() === "kafka";
  const completedDriver = createDriver("-social-orchestrator-completed");
  const failedDriver = isKafka ? createDriver("-social-orchestrator-failed") : completedDriver;
  const router = new CompletionRouter(completedDriver, failedDriver);
  const pub = new ExampleStatePublisher(REDIS_URL, roster(SOCIAL_AGENTS));
  const runLog = new RunLogger("social-media-team", PROJECT, GATEWAY_URL, getDriverType());
  const store = new RedisCheckpointStore(REDIS_URL);
  const orch = new WorkflowOrchestrator({ workflowId: WORKFLOW_ID, router, store });
  const budget = workflowBudgetFromEnv();

  const gw = await connectGateway(GATEWAY_URL, (m) => log.info(m));

  const cleanup = async (): Promise<void> => {
    gw.close();
    await completedDriver.disconnect();
    if (isKafka) await failedDriver.disconnect();
    await pub.disconnect();
    await store.disconnect();
  };

  try {
    log.info("=== KAIBAN DISTRIBUTED — SOCIAL MEDIA TEAM (fan-out/fan-in) ===");
    log.info(`Project: ${PROJECT} | Workflow: ${WORKFLOW_ID}`);
    if (await orch.isResuming()) log.info("Resuming from a prior checkpoint…");
    pub.workflowStarted({ project: PROJECT });

    // STEP 1 — Extract highlights
    log.info("\nSTEP 1 — Quill is extracting release highlights…");
    const extract = await orch.memoize<ExtractResult>("extract", () =>
      runExtractPhase(PROJECT, RELEASE_NOTES, router, pub, completedDriver, runLog),
    );
    log.info(`\nHIGHLIGHTS:\n${extract.highlights}\n`);
    assertWithinBudget(spend(runLog), budget);

    // STEP 2 — Fan-out to 4 composers in parallel, fan-in
    log.info("STEP 2 — Fan-out: Sparrow/Lincoln/Dot/Beacon composing in parallel…");
    const drafts = await orch.memoize<ComposedDraft[]>("compose", () =>
      runComposePhase(PROJECT, extract.highlights, router, pub, completedDriver, runLog),
    );
    const ok = drafts.filter((d) => !d.error).length;
    log.info(`\nComposed ${ok}/${drafts.length} platform drafts.\n`);
    assertWithinBudget(spend(runLog), budget);

    // STEP 3 — Aggregate
    log.info("STEP 3 — Mosaic is assembling the content pack…");
    const pack = await orch.memoize<string>("aggregate", () =>
      runAggregatePhase(PROJECT, drafts, router, pub, completedDriver, runLog),
    );

    log.info(`\n=== CONTENT PACK ===\n${pack}\n`);
    runLog.finish("DONE");
    await orch.clear();
    log.info(`View board: open viewer/board.html (gateway ${GATEWAY_URL})`);
  } catch (err: unknown) {
    const { totalTokens, totalCost } = runLog.totals;
    if (err instanceof BudgetExceededError) {
      pub.workflowStopped(randomUUID(), `Budget guard: ${err.reason}`, totalTokens, totalCost);
      runLog.finish("STOPPED");
      await orch.clear();
      log.info(`\nBudget guard tripped — ${err.reason}. Workflow stopped.`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      pub.workflowStopped(randomUUID(), `Workflow error: ${msg}`, totalTokens, totalCost);
      runLog.finish("FAILED");
      throw err;
    }
  } finally {
    const logPath = await runLog.flush("social-media-team/runs").catch(() => null);
    if (logPath) log.info(`Run log saved to ${logPath}`);
    await cleanup();
  }
}

function spend(runLog: RunLogger): { totalTokens: number; estimatedCost: number } {
  return { totalTokens: runLog.totals.totalTokens, estimatedCost: runLog.totals.totalCost };
}

main().catch((err: unknown) => {
  console.error("[SocialMediaTeam] Fatal error:", err);
  process.exit(1);
});

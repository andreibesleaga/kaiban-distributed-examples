/**
 * Trip Planning Orchestrator (sequential pipeline + HITL approval).
 *
 *   Peter Atlas (city) ──▶ Sophia Lore (insights) ──▶ Maxwell Journey (itinerary)
 *                                                              │
 *                                                   ┌──────────▼───────────┐
 *                                                   │  Human Decision (HITL) │
 *                                                   │  [1] APPROVE           │
 *                                                   │  [2] REVISE            │
 *                                                   │  [3] REJECT            │
 *                                                   └────────────────────────┘
 *
 * Each phase is checkpointed (Redis), so a crashed run restarted with the same
 * inputs resumes from the last completed phase instead of re-paying for it.
 *
 * Usage (local, after starting the worker nodes + gateway):
 *   ORIGIN="Berlin" DATES="first week of October" INTERESTS="food, history, jazz" \
 *   BUDGET="1500 EUR" npx ts-node trip-planning/orchestrator.ts
 */
import "dotenv/config";
import readline from "readline";
import { createHash } from "crypto";
import {
  createDriver,
  getDriverType,
  CompletionRouter,
  WorkflowOrchestrator,
  RedisCheckpointStore,
  waitForHITLDecision,
  workflowBudgetFromEnv,
  assertWithinBudget,
  createLogger,
} from "kaiban-distributed/shared";
import { ExampleStatePublisher, roster } from "../shared/state-publisher";
import { RunLogger } from "../shared/run-logger";
import { connectGateway } from "../shared/gateway";
import { ask } from "../shared/ask";
import { envOr } from "../shared/env";
import { endFailedRun, exitUnlessZero } from "../shared/run-end";
import { openStopSignal } from "../shared/stop-signal";
import { TRIP_AGENTS } from "./roster";
import {
  runCityPhase,
  runExpertPhase,
  runPlanPhase,
  type TripBrief,
  type PhaseResult,
} from "./phases";

const log = createLogger("TripPlanning");

const GATEWAY_URL = envOr("GATEWAY_URL", "http://localhost:3000");
const REDIS_URL = envOr("REDIS_URL", "redis://localhost:6379");

const brief: TripBrief = {
  origin: envOr("ORIGIN", "New York"),
  dates: envOr("DATES", "a long weekend next month"),
  interests: envOr("INTERESTS", "history, food, and architecture"),
  budget: envOr("BUDGET", "1500 USD"),
};

const WORKFLOW_ID = envOr(
  "WORKFLOW_ID",
  `trip-${createHash("sha256").update(JSON.stringify(brief)).digest("hex").slice(0, 16)}`,
);

async function main(): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const isKafka = getDriverType() === "kafka";
  const completedDriver = createDriver("-trip-orchestrator-completed");
  const failedDriver = isKafka ? createDriver("-trip-orchestrator-failed") : completedDriver;
  const router = new CompletionRouter(completedDriver, failedDriver);
  const pub = new ExampleStatePublisher(REDIS_URL, roster(TRIP_AGENTS));
  const runLog = new RunLogger("trip-planning", brief.interests, GATEWAY_URL, getDriverType());
  const store = new RedisCheckpointStore(REDIS_URL);
  // Emergency STOP ALL: only with CONTROL_PLANE_ENABLED=true (see README).
  const stop = await openStopSignal(REDIS_URL);
  const stopSignal = stop?.signal;
  const orch = new WorkflowOrchestrator({
    workflowId: WORKFLOW_ID,
    router,
    store,
    ...(stopSignal ? { stopSignal } : {}),
  });
  const budget = workflowBudgetFromEnv();

  const gw = await connectGateway(GATEWAY_URL, (m) => log.info(m));

  const cleanup = async (): Promise<void> => {
    gw.close();
    await completedDriver.disconnect();
    if (isKafka) await failedDriver.disconnect();
    await pub.disconnect();
    await store.disconnect();
    await stop?.close();
    rl.close();
  };

  let exitCode = 0;

  try {
    log.info("=== KAIBAN DISTRIBUTED — TRIP PLANNING ===");
    log.info(
      `From ${brief.origin} | ${brief.dates} | ${brief.budget} | interests: ${brief.interests}`,
    );
    log.info(`Workflow: ${WORKFLOW_ID}`);
    if (await orch.isResuming()) log.info("Resuming from a prior checkpoint…");
    pub.workflowStarted({ ...brief });

    // STEP 1 — City selection
    log.info("\nSTEP 1 — Peter Atlas is selecting the destination city…");
    const city = await orch.memoize<PhaseResult>("city", () =>
      runCityPhase(brief, router, pub, completedDriver, runLog, stopSignal),
    );
    log.info(`\nCITY CHOICE:\n${city.text}\n`);
    assertWithinBudget(spend(runLog), budget);

    // STEP 2 — Local insights
    log.info("STEP 2 — Sophia Lore is gathering local insights…");
    const insights = await orch.memoize<PhaseResult>("insights", () =>
      runExpertPhase(brief, city.text, router, pub, completedDriver, runLog, stopSignal),
    );
    log.info(`\nLOCAL INSIGHTS:\n${insights.text.slice(0, 600)}…\n`);
    assertWithinBudget(spend(runLog), budget);

    // STEP 3 — Itinerary
    log.info("STEP 3 — Maxwell Journey is assembling the itinerary…");
    const plan = await orch.memoize<PhaseResult>("plan", () =>
      runPlanPhase(brief, city.text, insights.text, router, pub, completedDriver, runLog, stopSignal),
    );
    log.info(`\n=== DRAFT ITINERARY ===\n${plan.text}\n`);
    assertWithinBudget(spend(runLog), budget);

    // STEP 4 — HITL
    await handleDecision({
      plan, brief, city, insights, router, pub, driver: completedDriver, rl, runLog, orch,
      ...(stopSignal ? { signal: stopSignal } : {}),
    });

    await orch.clear();
    log.info(`\nView board: open viewer/board.html (gateway ${GATEWAY_URL})`);
  } catch (err: unknown) {
    exitCode = await endFailedRun(err, { pub, runLog, orch, info: (m) => log.info(m) });
  } finally {
    const logPath = await runLog.flush("trip-planning/runs").catch(() => null);
    if (logPath) log.info(`Run log saved to ${logPath}`);
    await cleanup();
  }
  return exitCode;
}

function spend(runLog: RunLogger): { totalTokens: number; estimatedCost: number } {
  return { totalTokens: runLog.totals.totalTokens, estimatedCost: runLog.totals.totalCost };
}

interface DecisionDeps {
  plan: PhaseResult;
  brief: TripBrief;
  city: PhaseResult;
  insights: PhaseResult;
  router: CompletionRouter;
  pub: ExampleStatePublisher;
  driver: ReturnType<typeof createDriver>;
  rl: readline.Interface;
  runLog: RunLogger;
  orch: WorkflowOrchestrator;
  /** Emergency STOP ALL signal (CONTROL_PLANE_ENABLED): ends the HITL wait and the revision. */
  signal?: AbortSignal;
}

async function handleDecision(deps: DecisionDeps): Promise<void> {
  const { plan, brief, city, insights, pub, rl, runLog, router, driver, orch, signal } = deps;
  pub.awaitingHITL(plan.taskId, "Itinerary — Human Decision", "Approve / Revise / Reject");

  process.stdout.write(
    "\nHUMAN REVIEW: [1] APPROVE  [2] REVISE  [3] REJECT  [4] VIEW full itinerary\n" +
      "  (Decide here, or from the core repo's React board; viewer/board.html is read-only)\n",
  );

  const decision = await waitForHITLDecision({
    taskId: plan.taskId,
    rl,
    redisUrl: REDIS_URL,
    ...(signal ? { signal } : {}),
    onView: () => process.stdout.write(`\n--- ITINERARY ---\n${plan.text}\n---\n`),
  });

  const { totalTokens, totalCost } = runLog.totals;

  if (decision === "PUBLISH") {
    process.stdout.write(`\n--- APPROVED ITINERARY ---\n${plan.text}\n`);
    pub.workflowFinished(plan.taskId, `Trip: ${brief.interests}`, "concierge", totalTokens, totalCost);
    runLog.finish("APPROVED");
    return;
  }

  if (decision === "REVISE") {
    const notes = await ask(rl, "What should change? ");
    process.stdout.write("\nRe-running the concierge with your notes…\n");
    // Stable, unique checkpoint key for the revision (derived from the original
    // plan task) — deterministic on resume, no Date.now() collision window.
    const revised = await orch.memoize<PhaseResult>(`plan-revised-${plan.taskId}`, () =>
      runPlanPhase(
        brief,
        city.text,
        `${insights.text}\n\n--- REVISION NOTES ---\n${notes}`,
        router,
        pub,
        driver,
        runLog,
        signal,
      ),
    );
    process.stdout.write(`\n--- REVISED ITINERARY ---\n${revised.text}\n`);
    const t = runLog.totals;
    pub.workflowFinished(revised.taskId, `Trip: ${brief.interests}`, "concierge", t.totalTokens, t.totalCost);
    runLog.finish("REVISED");
    return;
  }

  process.stdout.write("\nItinerary rejected.\n");
  pub.workflowStopped(plan.taskId, "Rejected by human reviewer", totalTokens, totalCost);
  runLog.finish("REJECTED");
}

main()
  .then(exitUnlessZero)
  .catch((err: unknown) => {
    console.error("[TripPlanning] Fatal error:", err);
    process.exit(1);
  });

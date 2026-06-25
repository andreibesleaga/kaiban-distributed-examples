/**
 * Resume Creation Orchestrator — minimal 2-agent sequential pipeline.
 *
 *   Mary (analyze) ──▶ Alex Mercer (write) ──▶ resume
 *
 * The simplest example: no tools, no HITL. Each phase is checkpointed, so a
 * crash mid-run resumes from the last completed phase.
 *
 * Usage (local, after starting the analyst + writer nodes + gateway):
 *   CANDIDATE="$(cat my-notes.txt)" npx ts-node resume-creation/orchestrator.ts
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
import { RESUME_AGENTS } from "./team-config";
import { runAnalysisPhase, runWritePhase, type PhaseResult } from "./phases";

const log = createLogger("ResumeCreation");

const GATEWAY_URL = process.env["GATEWAY_URL"] ?? "http://localhost:3000";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const CANDIDATE =
  process.env["CANDIDATE"] ??
  `Jordan Lee. Email jordan.lee@example.com, based in Austin TX.
Worked 4 years at Cloudwave as a backend engineer — built a payments service in Go
handling 2M transactions/day, cut p99 latency from 400ms to 90ms, mentored 3 juniors.
Before that, 2 years at Bitline as a junior dev (Node.js, Postgres). BSc Computer
Science, UT Austin 2017. Skills: Go, TypeScript, Postgres, Kafka, AWS, Docker.
Won the internal 2022 reliability award.`;

const WORKFLOW_ID =
  process.env["WORKFLOW_ID"] ??
  `resume-${createHash("sha256").update(CANDIDATE).digest("hex").slice(0, 16)}`;

async function main(): Promise<void> {
  const isKafka = getDriverType() === "kafka";
  const completedDriver = createDriver("-resume-orchestrator-completed");
  const failedDriver = isKafka ? createDriver("-resume-orchestrator-failed") : completedDriver;
  const router = new CompletionRouter(completedDriver, failedDriver);
  const pub = new ExampleStatePublisher(REDIS_URL, roster(RESUME_AGENTS));
  const runLog = new RunLogger("resume-creation", "resume", GATEWAY_URL, getDriverType());
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
    log.info("=== KAIBAN DISTRIBUTED — RESUME CREATION ===");
    log.info(`Workflow: ${WORKFLOW_ID}`);
    if (await orch.isResuming()) log.info("Resuming from a prior checkpoint…");
    pub.workflowStarted({ candidateChars: CANDIDATE.length });

    // STEP 1 — Analyze
    log.info("\nSTEP 1 — Mary is analyzing the candidate profile…");
    const profile = await orch.memoize<PhaseResult>("analyze", () =>
      runAnalysisPhase(CANDIDATE, router, pub, completedDriver, runLog),
    );
    log.info(`\nSTRUCTURED PROFILE:\n${profile.text.slice(0, 600)}…\n`);
    assertWithinBudget(spend(runLog), budget);

    // STEP 2 — Write
    log.info("STEP 2 — Alex Mercer is writing the resume…");
    const resume = await orch.memoize<PhaseResult>("write", () =>
      runWritePhase(profile.text, router, pub, completedDriver, runLog),
    );

    log.info(`\n=== RESUME ===\n${resume.text}\n`);
    const { totalTokens, totalCost } = runLog.totals;
    pub.workflowFinished(resume.taskId, "Resume", "writer", totalTokens, totalCost);
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
    const logPath = await runLog.flush("resume-creation/runs").catch(() => null);
    if (logPath) log.info(`Run log saved to ${logPath}`);
    await cleanup();
  }
}

function spend(runLog: RunLogger): { totalTokens: number; estimatedCost: number } {
  return { totalTokens: runLog.totals.totalTokens, estimatedCost: runLog.totals.totalCost };
}

main().catch((err: unknown) => {
  console.error("[ResumeCreation] Fatal error:", err);
  process.exit(1);
});

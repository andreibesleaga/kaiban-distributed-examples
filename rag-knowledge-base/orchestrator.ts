/**
 * RAG Knowledge Base Orchestrator.
 *
 *   Question(s) ──▶ Product Specialist (Iris) + SimpleRAG tool ──▶ grounded answer
 *
 * Runs one or more questions through the specialist actor; each answer is
 * retrieved from the embedded knowledge base. Each question is checkpointed, so
 * a crash mid-batch resumes from the next unanswered question.
 *
 * Usage (local, after starting the specialist node + gateway):
 *   QUESTIONS="Is the T3 compatible with baseboard heaters?||How long is the warranty?" \
 *     npx ts-node rag-knowledge-base/orchestrator.ts
 */
import "dotenv/config";
import { createHash } from "crypto";
import {
  createDriver,
  getDriverType,
  CompletionRouter,
  WorkflowOrchestrator,
  RedisCheckpointStore,
  workflowBudgetFromEnv,
  assertWithinBudget,
  createLogger,
} from "kaiban-distributed/shared";
import { ExampleStatePublisher, roster } from "../shared/state-publisher";
import { RunLogger } from "../shared/run-logger";
import { connectGateway } from "../shared/gateway";
import { envOr } from "../shared/env";
import { endFailedRun, exitUnlessZero } from "../shared/run-end";
import { openStopSignal } from "../shared/stop-signal";
import { RAG_AGENTS } from "./roster";
import { runAnswerPhase, type AnswerResult } from "./phases";

const log = createLogger("RAGKnowledgeBase");

const GATEWAY_URL = envOr("GATEWAY_URL", "http://localhost:3000");
const REDIS_URL = envOr("REDIS_URL", "redis://localhost:6379");

const DEFAULT_QUESTIONS = [
  "Is the Nimbus T3 compatible with 240V baseboard heaters?",
  "How long is the warranty and how do I extend it?",
  "My thermostat screen is blank — what should I check first?",
];

const QUESTIONS = envOr("QUESTIONS", DEFAULT_QUESTIONS.join("||"))
  .split("||")
  .map((q) => q.trim())
  .filter(Boolean);

const WORKFLOW_ID = envOr(
  "WORKFLOW_ID",
  `rag-${createHash("sha256").update(QUESTIONS.join("||")).digest("hex").slice(0, 16)}`,
);

async function main(): Promise<number> {
  const isKafka = getDriverType() === "kafka";
  const completedDriver = createDriver("-rag-orchestrator-completed");
  const failedDriver = isKafka ? createDriver("-rag-orchestrator-failed") : completedDriver;
  const router = new CompletionRouter(completedDriver, failedDriver);
  const pub = new ExampleStatePublisher(REDIS_URL, roster(RAG_AGENTS));
  const runLog = new RunLogger("rag-knowledge-base", QUESTIONS[0] ?? "rag", GATEWAY_URL, getDriverType());
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
  };

  let exitCode = 0;

  try {
    log.info("=== KAIBAN DISTRIBUTED — RAG KNOWLEDGE BASE ===");
    log.info(`${QUESTIONS.length} question(s) | Workflow: ${WORKFLOW_ID}`);
    if (await orch.isResuming()) log.info("Resuming from a prior checkpoint…");
    pub.workflowStarted({ questions: QUESTIONS.length });

    const answers: AnswerResult[] = [];
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const question = QUESTIONS[i]!;
      log.info(`\nQ${i + 1}: ${question}`);
      const result = await orch.memoize<AnswerResult>(`q-${i}`, () =>
        runAnswerPhase(question, router, pub, completedDriver, runLog, stopSignal),
      );
      log.info(`A${i + 1}: ${result.answer}\n`);
      answers.push(result);
      assertWithinBudget(spend(runLog), budget);
    }

    const last = answers[answers.length - 1];
    if (last) {
      const { totalTokens, totalCost } = runLog.totals;
      pub.workflowFinished(last.taskId, "Knowledge base Q&A", "specialist", totalTokens, totalCost);
    }
    runLog.finish("DONE");
    await orch.clear();
    log.info(`Answered ${answers.length} question(s). Board: open viewer/board.html`);
  } catch (err: unknown) {
    exitCode = await endFailedRun(err, { pub, runLog, orch, info: (m) => log.info(m) });
  } finally {
    const logPath = await runLog.flush("rag-knowledge-base/runs").catch(() => null);
    if (logPath) log.info(`Run log saved to ${logPath}`);
    await cleanup();
  }
  return exitCode;
}

function spend(runLog: RunLogger): { totalTokens: number; estimatedCost: number } {
  return { totalTokens: runLog.totals.totalTokens, estimatedCost: runLog.totals.totalCost };
}

main()
  .then(exitUnlessZero)
  .catch((err: unknown) => {
    console.error("[RAGKnowledgeBase] Fatal error:", err);
    process.exit(1);
  });

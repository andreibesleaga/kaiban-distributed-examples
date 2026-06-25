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
import { RAG_AGENTS } from "./team-config";
import { runAnswerPhase, type AnswerResult } from "./phases";

const log = createLogger("RAGKnowledgeBase");

const GATEWAY_URL = process.env["GATEWAY_URL"] ?? "http://localhost:3000";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const DEFAULT_QUESTIONS = [
  "Is the Nimbus T3 compatible with 240V baseboard heaters?",
  "How long is the warranty and how do I extend it?",
  "My thermostat screen is blank — what should I check first?",
];

const QUESTIONS = (process.env["QUESTIONS"]
  ? process.env["QUESTIONS"].split("||")
  : DEFAULT_QUESTIONS
)
  .map((q) => q.trim())
  .filter(Boolean);

const WORKFLOW_ID =
  process.env["WORKFLOW_ID"] ??
  `rag-${createHash("sha256").update(QUESTIONS.join("||")).digest("hex").slice(0, 16)}`;

async function main(): Promise<void> {
  const isKafka = getDriverType() === "kafka";
  const completedDriver = createDriver("-rag-orchestrator-completed");
  const failedDriver = isKafka ? createDriver("-rag-orchestrator-failed") : completedDriver;
  const router = new CompletionRouter(completedDriver, failedDriver);
  const pub = new ExampleStatePublisher(REDIS_URL, roster(RAG_AGENTS));
  const runLog = new RunLogger("rag-knowledge-base", QUESTIONS[0] ?? "rag", GATEWAY_URL, getDriverType());
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
    log.info("=== KAIBAN DISTRIBUTED — RAG KNOWLEDGE BASE ===");
    log.info(`${QUESTIONS.length} question(s) | Workflow: ${WORKFLOW_ID}`);
    if (await orch.isResuming()) log.info("Resuming from a prior checkpoint…");
    pub.workflowStarted({ questions: QUESTIONS.length });

    const answers: AnswerResult[] = [];
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const question = QUESTIONS[i]!;
      log.info(`\nQ${i + 1}: ${question}`);
      const result = await orch.memoize<AnswerResult>(`q-${i}`, () =>
        runAnswerPhase(question, router, pub, completedDriver, runLog),
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
    const logPath = await runLog.flush("rag-knowledge-base/runs").catch(() => null);
    if (logPath) log.info(`Run log saved to ${logPath}`);
    await cleanup();
  }
}

function spend(runLog: RunLogger): { totalTokens: number; estimatedCost: number } {
  return { totalTokens: runLog.totals.totalTokens, estimatedCost: runLog.totals.totalCost };
}

main().catch((err: unknown) => {
  console.error("[RAGKnowledgeBase] Fatal error:", err);
  process.exit(1);
});

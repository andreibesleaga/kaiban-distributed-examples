/**
 * RAG Knowledge Base phases.
 *
 * Each question is one dispatch to the Product Specialist actor, which uses its
 * SimpleRAG tool to retrieve from the embedded knowledge base before answering.
 */
import {
  CompletionRouter,
  dispatchToAgent,
  parseHandlerResult,
} from "kaiban-distributed/shared";
import type { IMessagingDriver } from "kaiban-distributed";
import { ExampleStatePublisher } from "../shared/state-publisher";
import { RunLogger } from "../shared/run-logger";

export const ANSWER_WAIT_MS = parseInt(process.env["ANSWER_WAIT_MS"] ?? "180000", 10);

type Driver = Pick<IMessagingDriver, "publish">;

export interface AnswerResult {
  taskId: string;
  question: string;
  answer: string;
}

export async function runAnswerPhase(
  question: string,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<AnswerResult> {
  const taskId = await dispatchToAgent(driver, "specialist", {
    instruction: `Answer this customer question using the knowledge-base retrieval tool. Cite the relevant section. If the answer is not in the knowledge base, say so.\n\nQuestion: ${question}`,
    expectedOutput:
      "A concise, accurate answer grounded in the product knowledge base, with the section it came from.",
    inputs: { question },
  });
  pub.taskQueued(taskId, question, "specialist");

  const raw = await router
    .wait(taskId, ANSWER_WAIT_MS, "answer")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "specialist", "Answer", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("answer", taskId, "specialist", parsed);
  pub.taskDone(taskId, "specialist");
  pub.publishMetadata(runLog.meta);
  return { taskId, question, answer: parsed.answer };
}

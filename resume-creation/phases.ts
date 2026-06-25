/**
 * Resume Creation pipeline phases — analyze → write.
 */
import {
  CompletionRouter,
  dispatchToAgent,
  parseHandlerResult,
} from "kaiban-distributed/shared";
import type { IMessagingDriver } from "kaiban-distributed";
import { ExampleStatePublisher } from "../shared/state-publisher";
import { RunLogger } from "../shared/run-logger";

export const ANALYZE_WAIT_MS = parseInt(process.env["ANALYZE_WAIT_MS"] ?? "120000", 10);
export const WRITE_WAIT_MS = parseInt(process.env["WRITE_WAIT_MS"] ?? "180000", 10);

type Driver = Pick<IMessagingDriver, "publish">;

export interface PhaseResult {
  taskId: string;
  text: string;
}

export async function runAnalysisPhase(
  candidate: string,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<PhaseResult> {
  const taskId = await dispatchToAgent(driver, "analyst", {
    instruction:
      "Extract a structured professional profile from the candidate notes in the context: contact summary, skills, work experience with impact, education, and notable achievements. Flag gaps; do not invent details.",
    expectedOutput:
      "A structured profile (skills, experience, education, achievements) grounded only in the provided notes.",
    context: `--- CANDIDATE NOTES ---\n${candidate}`,
  });
  pub.taskQueued(taskId, "Analyze candidate profile", "analyst");

  const raw = await router
    .wait(taskId, ANALYZE_WAIT_MS, "profile analysis")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "analyst", "Profile analysis", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("analyze", taskId, "analyst", parsed);
  pub.taskDone(taskId, "analyst");
  pub.publishMetadata(runLog.meta);
  return { taskId, text: parsed.answer };
}

export async function runWritePhase(
  profile: string,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<PhaseResult> {
  const taskId = await dispatchToAgent(driver, "writer", {
    instruction:
      "Write a concise, ATS-friendly one-page resume in Markdown from the structured profile in the context, using the exact format from your background. Stay truthful to the profile.",
    expectedOutput: "A polished one-page Markdown resume.",
    context: `--- STRUCTURED PROFILE ---\n${profile}`,
  });
  pub.taskQueued(taskId, "Write resume", "writer");

  const raw = await router
    .wait(taskId, WRITE_WAIT_MS, "resume writing")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "writer", "Resume writing", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("write", taskId, "writer", parsed);
  pub.taskDone(taskId, "writer");
  pub.publishMetadata(runLog.meta);
  return { taskId, text: parsed.answer };
}

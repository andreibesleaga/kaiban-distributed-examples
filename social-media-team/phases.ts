/**
 * Social Media Team pipeline phases.
 *
 * The middle phase is the point of this example: ONE extract result fans out to
 * FOUR heterogeneous composer agents that run in parallel, then `router.waitAll`
 * joins them (partial-failure tolerant) before the aggregator runs.
 */
import {
  CompletionRouter,
  dispatchToAgent,
  parseHandlerResult,
} from "kaiban-distributed/shared";
import type { IMessagingDriver } from "kaiban-distributed";
import { ExampleStatePublisher } from "../shared/state-publisher";
import { RunLogger } from "../shared/run-logger";
import { COMPOSERS } from "./team-config";

export const EXTRACT_WAIT_MS = parseInt(process.env["EXTRACT_WAIT_MS"] ?? "120000", 10);
export const COMPOSE_WAIT_MS = parseInt(process.env["COMPOSE_WAIT_MS"] ?? "180000", 10);
export const AGGREGATE_WAIT_MS = parseInt(process.env["AGGREGATE_WAIT_MS"] ?? "180000", 10);

type Driver = Pick<IMessagingDriver, "publish">;

export interface ExtractResult {
  taskId: string;
  highlights: string;
}

export interface ComposedDraft {
  platform: string;
  agentId: string;
  text: string;
  error?: string;
}

export async function runExtractPhase(
  project: string,
  releaseNotes: string,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<ExtractResult> {
  const taskId = await dispatchToAgent(driver, "extractor", {
    instruction: `Extract the most shareable highlights from these release notes for project "${project}". Return 3–6 crisp bullets, and include the project name and version.`,
    expectedOutput: "3–6 bullet highlights with project name and version.",
    inputs: { project },
    context: `--- RELEASE NOTES ---\n${releaseNotes}`,
  });
  pub.taskQueued(taskId, `Extract highlights: ${project}`, "extractor");

  const raw = await router
    .wait(taskId, EXTRACT_WAIT_MS, "extraction")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "extractor", "Extraction", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("extract", taskId, "extractor", parsed);
  pub.taskDone(taskId, "extractor");
  pub.publishMetadata(runLog.meta);
  return { taskId, highlights: parsed.answer };
}

/**
 * Fan-out: dispatch all four composers at once, then fan-in with `waitAll`.
 * Wall-clock is the SLOWEST composer, not the sum — and one composer failing
 * does not sink the others (it comes back with an `error` instead of a draft).
 */
export async function runComposePhase(
  project: string,
  highlights: string,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<ComposedDraft[]> {
  // 1. Fan-out — one task per platform composer.
  const dispatched = await Promise.all(
    COMPOSERS.map(async (c) => {
      const taskId = await dispatchToAgent(driver, c.agentId, {
        instruction: `Write the ${c.platform} content for the "${project}" release using the highlights in the context.`,
        expectedOutput: `Platform-ready ${c.platform} copy.`,
        inputs: { project },
        context: `--- HIGHLIGHTS ---\n${highlights}`,
      });
      pub.taskQueued(taskId, `${c.platform} draft`, c.agentId);
      return { composer: c, taskId };
    }),
  );

  // 2. Fan-in — wait for all four, tolerant of partial failure.
  const byTask = new Map(dispatched.map((d) => [d.taskId, d.composer]));
  const settled = await router.waitAll(
    dispatched.map((d) => d.taskId),
    COMPOSE_WAIT_MS,
    "compose",
  );

  // 3. Map results back to their platform.
  const drafts: ComposedDraft[] = settled.map((s) => {
    const composer = byTask.get(s.taskId)!;
    if (s.error || s.result === undefined) {
      pub.taskFailed(s.taskId, composer.agentId, `${composer.platform} draft`, s.error ?? "no result");
      return { platform: composer.platform, agentId: composer.agentId, text: "", error: s.error ?? "no result" };
    }
    const parsed = parseHandlerResult(s.result);
    runLog.logTask("compose", s.taskId, composer.agentId, parsed);
    pub.taskDone(s.taskId, composer.agentId);
    return { platform: composer.platform, agentId: composer.agentId, text: parsed.answer };
  });

  pub.publishMetadata(runLog.meta);
  return drafts;
}

export async function runAggregatePhase(
  project: string,
  drafts: ComposedDraft[],
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<string> {
  const context = drafts
    .map((d) => `### ${d.platform}\n${d.error ? `(failed: ${d.error})` : d.text}`)
    .join("\n\n");

  const taskId = await dispatchToAgent(driver, "aggregator", {
    instruction: `Combine the four platform drafts for "${project}" into one labeled content pack, preserving each platform's formatting. Follow the exact shape from your background.`,
    expectedOutput: "A single content pack with one section per platform.",
    inputs: { project },
    context: `--- PLATFORM DRAFTS ---\n${context}`,
  });
  pub.taskQueued(taskId, "Aggregate content pack", "aggregator");

  const raw = await router
    .wait(taskId, AGGREGATE_WAIT_MS, "aggregation")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "aggregator", "Aggregation", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("aggregate", taskId, "aggregator", parsed);
  pub.workflowFinished(taskId, `Content pack: ${project}`, "aggregator", runLog.totals.totalTokens, runLog.totals.totalCost);
  pub.publishMetadata(runLog.meta);
  return parsed.answer;
}

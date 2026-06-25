/**
 * Trip Planning pipeline phases.
 *
 * Each phase dispatches one task to a worker node and awaits its completion via
 * the CompletionRouter, passing the previous phase's output forward as context.
 * Kept as standalone functions so the orchestrator stays small.
 */
import {
  CompletionRouter,
  dispatchToAgent,
  parseHandlerResult,
} from "kaiban-distributed/shared";
import type { IMessagingDriver } from "kaiban-distributed";
import { ExampleStatePublisher } from "../shared/state-publisher";
import { RunLogger } from "../shared/run-logger";

export const CITY_WAIT_MS = parseInt(process.env["CITY_WAIT_MS"] ?? "120000", 10);
export const EXPERT_WAIT_MS = parseInt(process.env["EXPERT_WAIT_MS"] ?? "180000", 10);
export const PLAN_WAIT_MS = parseInt(process.env["PLAN_WAIT_MS"] ?? "240000", 10);

export interface TripBrief {
  origin: string;
  dates: string;
  interests: string;
  budget: string;
}

export interface PhaseResult {
  taskId: string;
  text: string;
}

type Driver = Pick<IMessagingDriver, "publish">;

export async function runCityPhase(
  brief: TripBrief,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<PhaseResult> {
  const taskId = await dispatchToAgent(driver, "city-selector", {
    instruction: `Choose the single best destination city for a trip from "${brief.origin}" during ${brief.dates}, budget ${brief.budget}, focused on these interests: ${brief.interests}. State the chosen city on the first line, then justify it.`,
    expectedOutput:
      "One chosen city (named on the first line) with a concrete, fact-based rationale covering weather, cost, and seasonal events.",
    inputs: { ...brief },
  });
  pub.taskQueued(taskId, `Select city (${brief.interests})`, "city-selector");

  const raw = await router
    .wait(taskId, CITY_WAIT_MS, "city selection")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "city-selector", "City selection", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("city", taskId, "city-selector", parsed);
  pub.taskDone(taskId, "city-selector");
  pub.publishMetadata(runLog.meta);
  return { taskId, text: parsed.answer };
}

export async function runExpertPhase(
  brief: TripBrief,
  cityChoice: string,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<PhaseResult> {
  const taskId = await dispatchToAgent(driver, "local-expert", {
    instruction:
      "Using the chosen city in the context, provide rich local insights: neighborhoods, must-see attractions, food, customs, transport tips, and current seasonal happenings relevant to the traveler's interests and dates.",
    expectedOutput:
      "Themed local insights (attractions, food, customs, transport, seasonal events) for the chosen city.",
    inputs: { ...brief },
    context: `--- CITY CHOICE ---\n${cityChoice}`,
  });
  pub.taskQueued(taskId, "Gather local insights", "local-expert");

  const raw = await router
    .wait(taskId, EXPERT_WAIT_MS, "local insights")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "local-expert", "Local insights", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("expert", taskId, "local-expert", parsed);
  pub.taskDone(taskId, "local-expert");
  pub.publishMetadata(runLog.meta);
  return { taskId, text: parsed.answer };
}

export async function runPlanPhase(
  brief: TripBrief,
  cityChoice: string,
  localInsights: string,
  router: CompletionRouter,
  pub: ExampleStatePublisher,
  driver: Driver,
  runLog: RunLogger,
): Promise<PhaseResult> {
  const taskId = await dispatchToAgent(driver, "concierge", {
    instruction: `Assemble the final day-by-day itinerary for the trip (${brief.dates}, budget ${brief.budget}) using the city choice and local insights in the context. Follow the exact Markdown format from your background.`,
    expectedOutput:
      "A polished day-by-day itinerary in Markdown with timing, budget estimate, and practical tips.",
    inputs: { ...brief },
    context: `--- CITY CHOICE ---\n${cityChoice}\n\n--- LOCAL INSIGHTS ---\n${localInsights}`,
  });
  pub.taskQueued(taskId, "Assemble itinerary", "concierge");

  const raw = await router
    .wait(taskId, PLAN_WAIT_MS, "itinerary")
    .catch((err: Error) => {
      pub.taskFailed(taskId, "concierge", "Itinerary", err.message);
      throw err;
    });

  const parsed = parseHandlerResult(raw);
  runLog.logTask("plan", taskId, "concierge", parsed);
  pub.taskDone(taskId, "concierge");
  pub.publishMetadata(runLog.meta);
  return { taskId, text: parsed.answer };
}

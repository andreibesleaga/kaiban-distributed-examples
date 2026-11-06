import { test } from "node:test";
import assert from "node:assert/strict";
import { EmergencyStopError, type CompletionRouter } from "kaiban-distributed/shared";
import { assertSomeDraftSucceeded, runComposePhase, type ComposedDraft } from "../social-media-team/phases";
import type { ExampleStatePublisher } from "../shared/state-publisher";
import type { RunLogger } from "../shared/run-logger";

const draft = (platform: string, error?: string): ComposedDraft => ({
  platform,
  agentId: platform,
  text: error ? "" : "copy",
  ...(error ? { error } : {}),
});

test("a partial failure is tolerated", () => {
  assert.doesNotThrow(() => assertSomeDraftSucceeded([draft("tweet"), draft("blog", "Timeout")]));
});

test("a total failure throws, naming every platform", () => {
  assert.throws(
    () => assertSomeDraftSucceeded([draft("tweet", "Timeout"), draft("blog", "Timeout")]),
    /All 2 composers failed — tweet: Timeout; blog: Timeout/,
  );
});

function fakes(waitAll: () => Promise<Array<{ taskId: string; result?: string; error?: string }>>) {
  const events: string[] = [];
  const router = { waitAll } as unknown as CompletionRouter;
  const pub = {
    taskQueued: () => undefined,
    taskFailed: () => void events.push("taskFailed"),
    taskDone: () => undefined,
    publishMetadata: () => undefined,
  } as unknown as ExampleStatePublisher;
  const runLog = {
    meta: { totalTokens: 0, estimatedCost: 0 },
    logTask: () => undefined,
    logError: () => void events.push("logError"),
  } as unknown as RunLogger;
  const dispatched: string[] = [];
  const driver = { publish: async (channel: string) => void dispatched.push(channel) };
  return { router, pub, runLog, driver, events, dispatched };
}

test("the compose phase fails the run when every composer failed, and records the errors", async () => {
  const f = fakes(async () => []);
  // Make waitAll report an error for every dispatched task.
  f.router.waitAll = async (ids: string[]) => ids.map((taskId) => ({ taskId, error: "Timeout" }));
  await assert.rejects(runComposePhase("P", "h", f.router, f.pub, f.driver, f.runLog), /All 4 composers failed/);
  assert.equal(f.dispatched.length, 4);
  assert.equal(f.events.filter((e) => e === "logError").length, 4);
});

test("the compose phase ends with the stop error, not a draft list, after an emergency stop", async () => {
  const f = fakes(async () => []);
  const controller = new AbortController();
  f.router.waitAll = async (ids: string[]) => {
    controller.abort(new EmergencyStopError());
    return ids.map((taskId) => ({ taskId, error: "stopped" }));
  };
  await assert.rejects(
    runComposePhase("P", "h", f.router, f.pub, f.driver, f.runLog, controller.signal),
    (err: unknown) => err instanceof EmergencyStopError,
  );
});

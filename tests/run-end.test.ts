import { test } from "node:test";
import assert from "node:assert/strict";
import { BudgetExceededError, EmergencyStopError } from "kaiban-distributed/shared";
import { EXIT_EMERGENCY_STOP, endFailedRun, type RunEndDeps } from "../shared/run-end";

function fakeDeps(): { deps: RunEndDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: RunEndDeps = {
    pub: { workflowStopped: (_id, reason) => void calls.push(`stopped:${reason}`) },
    runLog: { totals: { totalTokens: 10, totalCost: 0.1 }, finish: (o) => void calls.push(`finish:${o}`) },
    orch: { clear: async () => void calls.push("clear") },
    info: () => undefined,
  };
  return { deps, calls };
}

test("an emergency stop ends STOPPED, clears the checkpoint and exits with code 2", async () => {
  const { deps, calls } = fakeDeps();
  const code = await endFailedRun(new EmergencyStopError(), deps);
  assert.equal(code, EXIT_EMERGENCY_STOP);
  assert.equal(EXIT_EMERGENCY_STOP, 2);
  assert.ok(calls.some((c) => c.startsWith("stopped:")));
  assert.ok(calls.includes("finish:STOPPED"));
  assert.ok(calls.includes("clear"));
});

test("a budget stop ends STOPPED, clears the checkpoint and exits with code 0", async () => {
  const { deps, calls } = fakeDeps();
  const code = await endFailedRun(new BudgetExceededError("cap reached"), deps);
  assert.equal(code, 0);
  assert.ok(calls.includes("stopped:Budget guard: cap reached"));
  assert.ok(calls.includes("finish:STOPPED"));
  assert.ok(calls.includes("clear"));
});

test("any other error ends FAILED, keeps the checkpoint and is rethrown", async () => {
  const { deps, calls } = fakeDeps();
  const boom = new Error("boom");
  await assert.rejects(endFailedRun(boom, deps), boom);
  assert.ok(calls.includes("stopped:Workflow error: boom"));
  assert.ok(calls.includes("finish:FAILED"));
  assert.ok(!calls.includes("clear"));
});

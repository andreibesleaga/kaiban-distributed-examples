/**
 * How an orchestrator ends a run that threw — shared by all four examples.
 *
 *  - Emergency STOP ALL (`EmergencyStopError`): every task of the run was
 *    killed. Publish STOPPED, clear the checkpoint (the next run starts fresh)
 *    and return exit code 2, the same code as the core examples.
 *  - Budget guard (`BudgetExceededError`): publish STOPPED, clear the
 *    checkpoint, return 0.
 *  - Anything else: publish FAILED, keep the checkpoint (a re-run resumes) and
 *    rethrow.
 */
import { randomUUID } from "crypto";
import { BudgetExceededError, EmergencyStopError } from "kaiban-distributed/shared";

/** Exit code of a run ended by an emergency STOP ALL. */
export const EXIT_EMERGENCY_STOP = 2;

export interface RunEndDeps {
  pub: {
    workflowStopped(taskId: string, reason: string, totalTokens: number, estimatedCost: number): void;
  };
  runLog: { totals: { totalTokens: number; totalCost: number }; finish(outcome: string): void };
  orch: { clear(): Promise<void> };
  info: (message: string) => void;
}

/** Returns the process exit code for a stop; rethrows any other error. */
export async function endFailedRun(err: unknown, deps: RunEndDeps): Promise<number> {
  const { pub, runLog, orch, info } = deps;
  const { totalTokens, totalCost } = runLog.totals;
  if (err instanceof EmergencyStopError) {
    pub.workflowStopped(randomUUID(), err.message, totalTokens, totalCost);
    runLog.finish("STOPPED");
    await orch.clear();
    info(`\n${err.message} — workflow stopped.`);
    return EXIT_EMERGENCY_STOP;
  }
  if (err instanceof BudgetExceededError) {
    pub.workflowStopped(randomUUID(), `Budget guard: ${err.reason}`, totalTokens, totalCost);
    runLog.finish("STOPPED");
    await orch.clear();
    info(`\nBudget guard tripped — ${err.reason}. Workflow stopped.`);
    return 0;
  }
  const msg = err instanceof Error ? err.message : String(err);
  pub.workflowStopped(randomUUID(), `Workflow error: ${msg}`, totalTokens, totalCost);
  runLog.finish("FAILED");
  throw err;
}

/** Exit now with `code` unless the run succeeded (a stop leaves wait timers armed). */
export function exitUnlessZero(code: number): void {
  if (code !== 0) process.exit(code);
}

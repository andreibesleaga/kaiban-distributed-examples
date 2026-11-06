/**
 * Emergency STOP ALL for an orchestrator: only with CONTROL_PLANE_ENABLED=true
 * (on every process). Returns the signal to pass to `WorkflowOrchestrator`
 * (`stopSignal`), to `router.wait(…, signal)` and to `waitForHITLDecision`,
 * or `null` when the control plane is off.
 */
import {
  controlPlaneEnabled,
  createEmergencyStopSignal,
  type EmergencyStopSignal,
} from "kaiban-distributed/shared";

export async function openStopSignal(redisUrl: string): Promise<EmergencyStopSignal | null> {
  return controlPlaneEnabled() ? createEmergencyStopSignal(redisUrl) : null;
}

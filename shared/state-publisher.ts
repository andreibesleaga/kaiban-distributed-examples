/**
 * Generic example state publisher — shared across all showcase examples.
 *
 * Extends the package's OrchestratorStatePublisher with the lifecycle events
 * every example orchestrator needs (workflowStarted / awaitingHITL /
 * workflowFinished / workflowStopped), parameterised by an agent roster so each
 * example just passes its own agents instead of subclassing.
 *
 * Only the orchestrator owns `teamWorkflowStatus` (workers never set it).
 */
import { OrchestratorStatePublisher } from "kaiban-distributed/shared";

export interface AgentDescriptor {
  agentId: string;
  name: string;
  role: string;
  status: "IDLE";
  currentTaskId: null;
}

/** Build an IDLE agent descriptor roster from compact tuples. */
export function roster(
  agents: Array<{ agentId: string; name: string; role: string }>,
): AgentDescriptor[] {
  return agents.map((a) => ({ ...a, status: "IDLE", currentTaskId: null }));
}

export class ExampleStatePublisher extends OrchestratorStatePublisher {
  constructor(
    redisUrl: string,
    private readonly agents: AgentDescriptor[],
  ) {
    super(redisUrl);
  }

  workflowStarted(inputs: Record<string, unknown>): void {
    this.publish({
      teamWorkflowStatus: "RUNNING",
      agents: this.agents,
      inputs,
      metadata: { startTime: Date.now() },
    });
  }

  awaitingHITL(taskId: string, title: string, summary: string): void {
    this.publish({
      teamWorkflowStatus: "RUNNING",
      agents: this.agents,
      tasks: [
        {
          taskId,
          title: title.slice(0, 60),
          status: "AWAITING_VALIDATION",
          assignedToAgentId: this.agents[this.agents.length - 1]?.agentId,
          result: summary.slice(0, 200),
        },
      ],
    });
  }

  workflowFinished(
    finalTaskId: string,
    title: string,
    agentId: string,
    totalTokens: number,
    estimatedCost: number,
  ): void {
    this.publish({
      teamWorkflowStatus: "FINISHED",
      agents: this.agents,
      tasks: [
        {
          taskId: finalTaskId,
          title: title.slice(0, 60),
          status: "DONE",
          assignedToAgentId: agentId,
          result: "Completed",
        },
      ],
      metadata: { totalTokens, estimatedCost, endTime: Date.now() },
    });
  }

  workflowStopped(
    taskId: string,
    reason: string,
    totalTokens: number,
    estimatedCost: number,
  ): void {
    this.publish({
      teamWorkflowStatus: "STOPPED",
      agents: this.agents,
      tasks: [
        {
          taskId,
          title: "Workflow ended",
          status: "BLOCKED",
          assignedToAgentId: this.agents[this.agents.length - 1]?.agentId,
          result: reason.slice(0, 200),
        },
      ],
      metadata: { totalTokens, estimatedCost, endTime: Date.now() },
    });
  }
}

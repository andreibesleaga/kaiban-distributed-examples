/**
 * Resilient gateway connection helper — shared across all orchestrators.
 *
 * Connects the orchestrator to the kaiban-distributed gateway for the live
 * Kanban board: probes /health, reads the A2A AgentCard, and opens a Socket.io
 * channel that echoes board workflow-status updates to the console.
 *
 * Every step is best-effort: if the gateway is down (e.g. a quick local run with
 * only Redis up), the workflow still completes — you just don't get the board.
 */
import { io, type Socket } from "socket.io-client";
import { parseAgentCardSkills } from "./agent-card";

export interface GatewayHandle {
  socket: Socket | null;
  close(): void;
}

/** Best-effort connect to the gateway; never throws. */
export async function connectGateway(
  gatewayUrl: string,
  log: (msg: string) => void,
): Promise<GatewayHandle> {
  try {
    const health = (await fetch(`${gatewayUrl}/health`).then((r) => r.json())) as {
      data?: { status?: string };
    };
    log(`Gateway: ${(health.data?.status ?? "ok").toUpperCase()} at ${gatewayUrl}`);

    const card = (await fetch(`${gatewayUrl}/.well-known/agent-card.json`).then(
      (r) => r.json(),
    )) as { name?: string; skills?: Array<{ id?: string; name?: string }> };
    const skills = parseAgentCardSkills(card);
    if (card.name) log(`Agent: ${card.name}${skills ? ` — [${skills}]` : ""}`);
  } catch {
    log(
      `Gateway not reachable at ${gatewayUrl} — continuing without the board ` +
        `(start it to see the live Kanban).`,
    );
    return { socket: null, close: () => {} };
  }

  let socket: Socket | null = null;
  try {
    socket = io(gatewayUrl, { transports: ["websocket"] });
    socket.on("state:update", (delta: Record<string, unknown>) => {
      const status = delta["teamWorkflowStatus"] ?? delta["status"];
      if (status) process.stdout.write(`  ⬡ Board: ${String(status)}\n`);
    });
  } catch {
    socket = null;
  }

  return {
    socket,
    close: () => {
      socket?.disconnect();
    },
  };
}

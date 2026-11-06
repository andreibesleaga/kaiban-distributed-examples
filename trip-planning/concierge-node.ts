import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { conciergeConfig, CONCIERGE_QUEUE } from "./team-config";

startAgentNode({
  agentId: "concierge", // fixed: the orchestrator dispatches to this id, so AGENT_ID is not read
  queue: CONCIERGE_QUEUE,
  agentConfig: conciergeConfig,
  displayName: "Maxwell Journey",
  role: "Travel Concierge",
  label: "[Concierge]",
}).catch((err: unknown) => {
  console.error("[Concierge] Startup failed:", err);
  process.exit(1);
});

import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { localExpertConfig, EXPERT_QUEUE } from "./team-config";

startAgentNode({
  agentId: "local-expert", // fixed: the orchestrator dispatches to this id, so AGENT_ID is not read
  queue: EXPERT_QUEUE,
  agentConfig: localExpertConfig,
  displayName: "Sophia Lore",
  role: "Local Expert",
  label: "[LocalExpert]",
}).catch((err: unknown) => {
  console.error("[LocalExpert] Startup failed:", err);
  process.exit(1);
});

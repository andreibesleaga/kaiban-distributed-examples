import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { localExpertConfig, EXPERT_QUEUE } from "./team-config";

startAgentNode({
  agentId: process.env["AGENT_ID"] ?? "local-expert",
  queue: EXPERT_QUEUE,
  agentConfig: localExpertConfig,
  displayName: "Sophia Lore",
  role: "Local Expert",
  label: "[LocalExpert]",
}).catch((err: unknown) => {
  console.error("[LocalExpert] Startup failed:", err);
  process.exit(1);
});

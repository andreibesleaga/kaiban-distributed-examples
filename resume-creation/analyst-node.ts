import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { analystConfig, ANALYST_QUEUE } from "./team-config";

startAgentNode({
  agentId: "analyst", // fixed: the orchestrator dispatches to this id, so AGENT_ID is not read
  queue: ANALYST_QUEUE,
  agentConfig: analystConfig,
  displayName: "Mary",
  role: "Profile Analyst",
  label: "[Analyst]",
}).catch((err: unknown) => {
  console.error("[Analyst] Startup failed:", err);
  process.exit(1);
});

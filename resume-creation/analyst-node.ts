import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { analystConfig, ANALYST_QUEUE } from "./team-config";

startAgentNode({
  agentId: process.env["AGENT_ID"] ?? "analyst",
  queue: ANALYST_QUEUE,
  agentConfig: analystConfig,
  displayName: "Mary",
  role: "Profile Analyst",
  label: "[Analyst]",
}).catch((err: unknown) => {
  console.error("[Analyst] Startup failed:", err);
  process.exit(1);
});

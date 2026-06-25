import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { specialistConfig, SPECIALIST_QUEUE } from "./team-config";

startAgentNode({
  agentId: process.env["AGENT_ID"] ?? "specialist",
  queue: SPECIALIST_QUEUE,
  agentConfig: specialistConfig,
  displayName: "Iris",
  role: "Product Specialist",
  label: "[Specialist]",
}).catch((err: unknown) => {
  console.error("[Specialist] Startup failed:", err);
  process.exit(1);
});

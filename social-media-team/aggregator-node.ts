import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { aggregatorConfig, AGGREGATOR_QUEUE } from "./team-config";

startAgentNode({
  agentId: process.env["AGENT_ID"] ?? "aggregator",
  queue: AGGREGATOR_QUEUE,
  agentConfig: aggregatorConfig,
  displayName: "Mosaic",
  role: "Result Aggregator",
  label: "[Aggregator]",
}).catch((err: unknown) => {
  console.error("[Aggregator] Startup failed:", err);
  process.exit(1);
});

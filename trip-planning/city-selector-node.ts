import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { citySelectorConfig, CITY_QUEUE } from "./team-config";

startAgentNode({
  agentId: "city-selector", // fixed: the orchestrator dispatches to this id, so AGENT_ID is not read
  queue: CITY_QUEUE,
  agentConfig: citySelectorConfig,
  displayName: "Peter Atlas",
  role: "City Selector",
  label: "[CitySelector]",
}).catch((err: unknown) => {
  console.error("[CitySelector] Startup failed:", err);
  process.exit(1);
});

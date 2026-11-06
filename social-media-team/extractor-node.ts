import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { extractorConfig, EXTRACTOR_QUEUE } from "./team-config";

startAgentNode({
  agentId: "extractor", // fixed: the orchestrator dispatches to this id, so AGENT_ID is not read
  queue: EXTRACTOR_QUEUE,
  agentConfig: extractorConfig,
  displayName: "Quill",
  role: "Content Extractor",
  label: "[Extractor]",
}).catch((err: unknown) => {
  console.error("[Extractor] Startup failed:", err);
  process.exit(1);
});

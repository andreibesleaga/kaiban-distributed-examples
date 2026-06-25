import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { extractorConfig, EXTRACTOR_QUEUE } from "./team-config";

startAgentNode({
  agentId: process.env["AGENT_ID"] ?? "extractor",
  queue: EXTRACTOR_QUEUE,
  agentConfig: extractorConfig,
  displayName: "Quill",
  role: "Content Extractor",
  label: "[Extractor]",
}).catch((err: unknown) => {
  console.error("[Extractor] Startup failed:", err);
  process.exit(1);
});

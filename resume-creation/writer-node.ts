import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { writerConfig, WRITER_QUEUE } from "./team-config";

startAgentNode({
  agentId: "writer", // fixed: the orchestrator dispatches to this id, so AGENT_ID is not read
  queue: WRITER_QUEUE,
  agentConfig: writerConfig,
  displayName: "Alex Mercer",
  role: "Resume Writer",
  label: "[Writer]",
}).catch((err: unknown) => {
  console.error("[Writer] Startup failed:", err);
  process.exit(1);
});

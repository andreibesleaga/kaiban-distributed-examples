/**
 * Generic platform-composer worker node.
 *
 * One file, four deployments: the AGENT_ID env var (tweet | linkedin | discord |
 * blog) selects which composer config this process runs. This is the parallel
 * fan-out tier — each composer is an independent actor on its own queue.
 */
import "dotenv/config";
import { startAgentNode } from "kaiban-distributed/shared";
import { COMPOSERS } from "./team-config";

const agentId = process.env["AGENT_ID"];
const composer = COMPOSERS.find((c) => c.agentId === agentId);

if (!composer) {
  console.error(
    `[Composer] AGENT_ID must be one of: ${COMPOSERS.map((c) => c.agentId).join(", ")} (got "${agentId ?? ""}")`,
  );
  process.exit(1);
}

startAgentNode({
  agentId: composer.agentId,
  queue: composer.queue,
  agentConfig: composer.config,
  displayName: composer.displayName,
  role: `${composer.platform} Composer`,
  label: `[${composer.platform}]`,
}).catch((err: unknown) => {
  console.error(`[${composer.platform}] Startup failed:`, err);
  process.exit(1);
});

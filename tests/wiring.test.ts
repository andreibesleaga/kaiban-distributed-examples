/**
 * Guards for what a unit test cannot run: the orchestrators start a real
 * workflow on import, and the compose files need Docker. These read the files.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const EXAMPLES = ["resume-creation", "trip-planning", "social-media-team", "rag-knowledge-base"];
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

test("every orchestrator wires the emergency stop", () => {
  for (const ex of EXAMPLES) {
    const src = read(`${ex}/orchestrator.ts`);
    assert.match(src, /openStopSignal\(REDIS_URL\)/, ex);
    assert.match(src, /stopSignal: ?|\.\.\.\(stopSignal \? \{ stopSignal \}/, ex);
    assert.match(src, /endFailedRun\(err,/, ex);
    assert.match(src, /exitUnlessZero/, ex);
  }
});

test("the trip HITL wait receives the stop signal", () => {
  assert.match(read("trip-planning/orchestrator.ts"), /waitForHITLDecision\(\{[\s\S]*?\.\.\.\(signal \? \{ signal \} : \{\}\)/);
});

/** The services of a compose file as `name -> text`, split on two-space keys under `services:`. */
function services(file: string): Map<string, string> {
  const text = read(file);
  const body = text.slice(text.indexOf("\nservices:\n"));
  const out = new Map<string, string>();
  for (const m of body.matchAll(/^ {2}([\w-]+):\n((?: {4}.*\n|\n)*)/gm)) out.set(m[1]!, m[2]!);
  return out;
}

const composeFiles = ["docker-compose.infra.yml"].concat(EXAMPLES.flatMap((ex) =>
  readdirSync(path.join(ROOT, ex)).filter((f) => /^docker-compose.*\.yml$/.test(f)).map((f) => `${ex}/${f}`),
));

test("there are seven compose files", () => assert.equal(composeFiles.length, 7));

test("every service that runs our image passes CONTROL_PLANE_ENABLED; gateways also BOARD_JWT_SECRET", () => {
  for (const file of composeFiles) {
    assert.ok(services(file).has("gateway"), `${file}: no services parsed`);
    const anchor = /x-worker-env[\s\S]*?\n\n/.exec(read(file))?.[0] ?? "";
    for (const [name, block] of services(file)) {
      if (!/^ {4}build:/m.test(block)) continue; // redis, zookeeper, kafka
      const usesAnchor = /<<: \*worker-env/.test(block);
      const has = /CONTROL_PLANE_ENABLED: \$\{CONTROL_PLANE_ENABLED:-\}/.test(block) ||
        (usesAnchor && anchor.includes("CONTROL_PLANE_ENABLED: ${CONTROL_PLANE_ENABLED:-}"));
      assert.ok(has, `${file}: ${name} lacks CONTROL_PLANE_ENABLED`);
      if (name === "gateway") assert.match(block, /BOARD_JWT_SECRET: \$\{BOARD_JWT_SECRET:-\}/, file);
    }
  }
});

test("every documented orchestrator command in the compose headers reads the root .env", () => {
  for (const file of composeFiles) {
    for (const line of read(file).split("\n")) {
      if (/^# +docker compose .* (up|run) /.test(line)) assert.match(line, /--env-file \.env/, `${file}: ${line}`);
    }
  }
});

test("no compose file says 0 means unlimited", () => {
  for (const file of composeFiles) assert.doesNotMatch(read(file), /MAX_WORKFLOW_TOKENS:-0\}/, file);
});

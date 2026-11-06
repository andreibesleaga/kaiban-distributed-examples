import { test } from "node:test";
import assert from "node:assert/strict";
import readline from "readline";
import { PassThrough } from "stream";
import { ask } from "../shared/ask";

test("ask returns the trimmed answer", async () => {
  const rl = { question: (_q: string, cb: (a: string) => void) => cb("  more food ") };
  assert.equal(await ask(rl, "What should change? "), "more food");
});

test("ask returns an empty answer on a closed readline instead of throwing", async () => {
  const rl = readline.createInterface({ input: new PassThrough(), output: new PassThrough() });
  rl.close();
  assert.equal(await ask(rl, "What should change? "), "");
});

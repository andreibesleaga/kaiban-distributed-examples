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

test("ask resolves with an empty answer when stdin ends while the prompt is open", async () => {
  const input = new PassThrough();
  const rl = readline.createInterface({ input, output: new PassThrough() });
  const pending = ask(rl, "What should change? ");
  input.end(); // EOF: readline closes without calling the question callback
  assert.equal(await pending, "");
});

test("ask rejects with the stop reason when the signal aborts while the prompt is open", async () => {
  const rl = readline.createInterface({ input: new PassThrough(), output: new PassThrough() });
  const ac = new AbortController();
  const pending = ask(rl, "What should change? ", ac.signal);
  const reason = new Error("Emergency stop: operator");
  ac.abort(reason);
  await assert.rejects(pending, (e) => e === reason);
  rl.close();
});

test("ask rejects at once on an already aborted signal", async () => {
  const rl = { question: () => { throw new Error("must not be asked"); } };
  const ac = new AbortController();
  ac.abort(new Error("stopped"));
  await assert.rejects(ask(rl, "q", ac.signal), /stopped/);
});

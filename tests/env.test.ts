import { test } from "node:test";
import assert from "node:assert/strict";
import { envInt, envOr, firstEnv } from "../shared/env";

// Docker Compose passes `NAME: ${NAME:-}`, so an unset input arrives as "".
test("envOr uses the fallback for unset, empty and blank values", () => {
  assert.equal(envOr("X", "dflt", {}), "dflt");
  assert.equal(envOr("X", "dflt", { X: "" }), "dflt");
  assert.equal(envOr("X", "dflt", { X: "   " }), "dflt");
});

test("envOr returns the trimmed value when set", () => {
  assert.equal(envOr("X", "dflt", { X: "  Berlin " }), "Berlin");
});

test("firstEnv skips empty values and keeps the order", () => {
  const env = { RAG_OPENAI_API_KEY: "", OPENAI_API_KEY: "sk-test" };
  assert.equal(firstEnv(["RAG_OPENAI_API_KEY", "OPENAI_API_KEY"], env), "sk-test");
  assert.equal(firstEnv(["RAG_OPENAI_API_KEY"], env), undefined);
  assert.equal(
    firstEnv(["RAG_OPENAI_API_KEY", "OPENAI_API_KEY"], { RAG_OPENAI_API_KEY: "a", OPENAI_API_KEY: "b" }),
    "a",
  );
});

test("envInt falls back for unset, empty, non-numeric and non-positive values", () => {
  assert.equal(envInt("W", 120000, {}), 120000);
  assert.equal(envInt("W", 120000, { W: "" }), 120000);
  assert.equal(envInt("W", 120000, { W: "abc" }), 120000);
  assert.equal(envInt("W", 120000, { W: "0" }), 120000);
  assert.equal(envInt("W", 120000, { W: "5000" }), 5000);
});

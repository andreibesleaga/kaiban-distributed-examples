/**
 * Resume Creation — team configuration.
 *
 * Ported from the KaibanJS "Multi-Agent Resume Creation" example into the
 * kaiban-distributed actor model. The simplest possible port: a two-agent
 * sequential pipeline, each agent its own worker process.
 *
 *   Mary (Profile Analyst) ──▶ Alex Mercer (Resume Writer)
 *
 * Pure LLM reasoning — no external tools. Runs with just an LLM key
 * (OPENAI_API_KEY / OPENROUTER_API_KEY / OPENAI_BASE_URL + LLM_MODEL).
 */
import type { KaibanAgentConfig } from "kaiban-distributed";
import { buildLLMConfig } from "kaiban-distributed/shared";

const llmConfig = buildLLMConfig();
const llm = llmConfig ? { llmConfig } : {};

export const ANALYST_QUEUE = "kaiban-agents-analyst";
export const WRITER_QUEUE = "kaiban-agents-writer";

/** Mary — extracts a structured professional profile from raw candidate info. */
export const analystConfig: KaibanAgentConfig = {
  name: "Mary",
  role: "Profile Analyst",
  goal: "Extract a clean, structured professional profile from a candidate's raw notes: contact summary, skills, work experience (with impact), education, and notable achievements.",
  background:
    "A meticulous talent analyst. Organizes messy candidate notes into structured sections, infers nothing that isn't supported, and flags gaps rather than inventing details.",
  maxIterations: 8,
  ...llm,
};

/** Alex Mercer — turns the structured profile into a polished resume. */
export const writerConfig: KaibanAgentConfig = {
  name: "Alex Mercer",
  role: "Resume Writer",
  goal: "Write a concise, ATS-friendly one-page resume in Markdown from the structured profile, using strong action verbs and quantified impact.",
  background: `An expert resume writer. Produce the resume in this exact Markdown shape:

# [Full Name]
[role headline] · [location] · [email]

## Summary
[2-3 sentences]

## Skills
- [grouped, comma-separated]

## Experience
### [Title] — [Company] ([dates])
- [action-verb achievement with metric]

## Education
- [degree], [institution] ([year])

Keep it truthful to the profile; never fabricate employers, dates, or metrics.`,
  maxIterations: 12,
  forceFinalAnswer: true,
  ...llm,
};

/** Agent roster for the board. */
export const RESUME_AGENTS = [
  { agentId: "analyst", name: "Mary", role: "Profile Analyst" },
  { agentId: "writer", name: "Alex Mercer", role: "Resume Writer" },
];

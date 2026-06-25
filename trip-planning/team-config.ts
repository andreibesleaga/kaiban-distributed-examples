/**
 * Trip Planning — team configuration.
 *
 * Ported from the KaibanJS "Multi-Agent Trip Planning" example
 * (https://www.kaibanjs.com/examples) into the kaiban-distributed actor model:
 * a sequential 3-agent pipeline where each agent runs as its own worker node.
 *
 *   Peter Atlas (City Selector) ──▶ Sophia Lore (Local Expert) ──▶ Maxwell Journey (Concierge)
 *
 * The City Selector and Local Expert get a real web-search tool (Tavily or
 * Serper) when its API key is present; otherwise they reason from the model's
 * own knowledge. The Concierge is pure synthesis.
 *
 * LLM is resolved from env via the package's buildLLMConfig()
 * (OPENAI_API_KEY | OPENROUTER_API_KEY | OPENAI_BASE_URL + LLM_MODEL).
 */
import type { KaibanAgentConfig } from "kaiban-distributed";
import { buildLLMConfig } from "kaiban-distributed/shared";
import { TavilySearchResults } from "@kaibanjs/tools/tavily";
import { Serper } from "@kaibanjs/tools/serper";

export const CITY_QUEUE = "kaiban-agents-city-selector";
export const EXPERT_QUEUE = "kaiban-agents-local-expert";
export const CONCIERGE_QUEUE = "kaiban-agents-concierge";

const llmConfig = buildLLMConfig();

/** KaibanJS/LangChain tools are structurally compatible; cast at the seam. */
type AgentTools = NonNullable<KaibanAgentConfig["tools"]>;

/**
 * Build a web-search tool from env: Tavily if TAVILY_API_KEY is set, else Serper
 * if SERPER_API_KEY is set, else undefined (agents reason without live search).
 */
function buildSearchTool(): AgentTools | undefined {
  const tavilyKey = process.env["TAVILY_API_KEY"];
  if (tavilyKey) {
    return [
      new TavilySearchResults({ apiKey: tavilyKey, maxResults: 5 }),
    ] as unknown as AgentTools;
  }
  const serperKey = process.env["SERPER_API_KEY"];
  if (serperKey) {
    return [new Serper({ apiKey: serperKey, type: "search" })] as unknown as AgentTools;
  }
  return undefined;
}

const searchTool = buildSearchTool();
const withSearch = searchTool ? { tools: searchTool } : {};

/** Peter Atlas — picks the single best destination city for the trip. */
export const citySelectorConfig: KaibanAgentConfig = {
  name: "Peter Atlas",
  role: "City Selector",
  goal: "Choose the single best destination city for the traveler given their origin, dates, budget, and interests, and justify the choice with concrete facts (weather, costs, seasonal events).",
  background:
    "A seasoned travel analyst who weighs weather, price, safety, and seasonal events to recommend one optimal city. Always states the chosen city clearly on the first line, then the rationale.",
  maxIterations: 10,
  ...withSearch,
  ...(llmConfig ? { llmConfig } : {}),
};

/** Sophia Lore — surfaces local, insider knowledge for the chosen city. */
export const localExpertConfig: KaibanAgentConfig = {
  name: "Sophia Lore",
  role: "Local Expert",
  goal: "Provide rich, up-to-date local insights for the chosen city: neighborhoods, must-see attractions, food, customs, transport tips, and current seasonal happenings.",
  background:
    "A local guide with deep knowledge of culture, cuisine, and hidden gems. Distinguishes confirmed facts from general advice and organizes insights by theme.",
  maxIterations: 12,
  ...withSearch,
  ...(llmConfig ? { llmConfig } : {}),
};

/** Maxwell Journey — assembles the final day-by-day itinerary. */
export const conciergeConfig: KaibanAgentConfig = {
  name: "Maxwell Journey",
  role: "Travel Concierge",
  goal: "Turn the city choice and local insights into a polished, day-by-day itinerary with timing, a budget estimate, and packing suggestions.",
  background: `An expert travel concierge. Produce the final plan in this exact Markdown shape:

# Trip Plan: [City]
**Dates:** [dates]  **Estimated budget:** [amount]
## Why [City]
[2-3 sentences]
## Day-by-Day Itinerary
### Day 1 — [theme]
- Morning: …
- Afternoon: …
- Evening: …
(repeat per day)
## Practical Tips
- Transport: …
- Food to try: …
- Packing: …`,
  maxIterations: 15,
  forceFinalAnswer: true,
  ...(llmConfig ? { llmConfig } : {}),
};

/** Agent roster for the board (drives the Kanban swim-lanes). */
export const TRIP_AGENTS = [
  { agentId: "city-selector", name: "Peter Atlas", role: "City Selector" },
  { agentId: "local-expert", name: "Sophia Lore", role: "Local Expert" },
  { agentId: "concierge", name: "Maxwell Journey", role: "Travel Concierge" },
];

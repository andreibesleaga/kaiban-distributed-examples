/**
 * GitHub Release Social Media Team — team configuration.
 *
 * Ported from the KaibanJS "GitHub Release Social Media Team" example into the
 * kaiban-distributed actor model, showcasing a HETEROGENEOUS fan-out/fan-in
 * topology that the existing core examples don't:
 *
 *                     ┌──▶ TweetComposer ──┐
 *                     ├──▶ LinkedInComposer┤
 *   ContentExtractor ─┤                    ├──▶ ResultAggregator
 *                     ├──▶ DiscordComposer ┤
 *                     └──▶ BlogComposer ───┘
 *
 * One extractor distills release notes into highlights; FOUR distinct composer
 * agents then run IN PARALLEL (each its own worker process / queue), and an
 * aggregator joins their outputs into one content pack.
 */
import type { KaibanAgentConfig } from "kaiban-distributed";
import { buildLLMConfig } from "kaiban-distributed/shared";

const llmConfig = buildLLMConfig();
const llm = llmConfig ? { llmConfig } : {};

export const EXTRACTOR_QUEUE = "kaiban-agents-extractor";
export const AGGREGATOR_QUEUE = "kaiban-agents-aggregator";

/** ContentExtractor — distills raw release notes into shareable highlights. */
export const extractorConfig: KaibanAgentConfig = {
  name: "Quill",
  role: "Content Extractor",
  goal: "Read raw release notes and extract the 3–6 most shareable highlights (new features, fixes, breaking changes) as crisp bullet points with the version and project name.",
  background:
    "A release-notes analyst who separates headline-worthy changes from noise and writes tight, accurate bullets that downstream writers can build on.",
  maxIterations: 8,
  ...llm,
};

/** ResultAggregator — joins the four platform drafts into one content pack. */
export const aggregatorConfig: KaibanAgentConfig = {
  name: "Mosaic",
  role: "Result Aggregator",
  goal: "Combine the four platform drafts (Tweet, LinkedIn, Discord, Blog) into a single, well-labeled content pack ready to copy-paste, preserving each platform's formatting.",
  background: `A social media manager. Produce the final output in this exact shape:

# Release Content Pack: [project] [version]
## 🐦 Tweet/X
[tweet]
## 💼 LinkedIn
[post]
## 💬 Discord
[message]
## 📝 Blog
[post]`,
  maxIterations: 10,
  forceFinalAnswer: true,
  ...llm,
};

/** A single platform composer in the parallel fan-out tier. */
export interface Composer {
  agentId: string;
  queue: string;
  platform: string;
  displayName: string;
  config: KaibanAgentConfig;
}

function composer(
  agentId: string,
  displayName: string,
  platform: string,
  goal: string,
  background: string,
): Composer {
  return {
    agentId,
    queue: `kaiban-agents-${agentId}`,
    platform,
    displayName,
    config: {
      name: displayName,
      role: `${platform} Composer`,
      goal,
      background,
      maxIterations: 8,
      forceFinalAnswer: true,
      ...llm,
    },
  };
}

/** The four heterogeneous composers that run in parallel. */
export const COMPOSERS: Composer[] = [
  composer(
    "tweet",
    "Sparrow",
    "Tweet/X",
    "Write one punchy tweet (≤280 chars) announcing the release highlights, with 1–2 relevant hashtags and an optional emoji.",
    "A growth marketer who writes high-engagement tweets. Output ONLY the tweet text, no commentary.",
  ),
  composer(
    "linkedin",
    "Lincoln",
    "LinkedIn",
    "Write a professional LinkedIn post (2–4 short paragraphs) announcing the release, framed around user value, ending with a soft call to action.",
    "A developer-relations lead. Professional but human tone. Output ONLY the post.",
  ),
  composer(
    "discord",
    "Dot",
    "Discord",
    "Write a friendly Discord community announcement using markdown, bullet highlights, and an @everyone-free upbeat tone.",
    "A community manager. Casual, enthusiastic, uses markdown and emoji. Output ONLY the message.",
  ),
  composer(
    "blog",
    "Beacon",
    "Blog",
    "Write a short blog post (250–400 words) with a headline, intro, a 'What's new' section, and a closing line.",
    "A technical content writer. Clear and structured. Output the post in Markdown only.",
  ),
];

/** Agent roster for the board (extractor → 4 composers → aggregator). */
export const SOCIAL_AGENTS = [
  { agentId: "extractor", name: "Quill", role: "Content Extractor" },
  ...COMPOSERS.map((c) => ({
    agentId: c.agentId,
    name: c.displayName,
    role: `${c.platform} Composer`,
  })),
  { agentId: "aggregator", name: "Mosaic", role: "Result Aggregator" },
];

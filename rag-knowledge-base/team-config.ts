/**
 * RAG Product Knowledge Base — team configuration.
 *
 * Ported from the KaibanJS "AI Agent with RAG: Product Knowledge Base" example.
 * A single Product Specialist agent answers questions grounded in a product
 * knowledge base via the @kaibanjs/tools SimpleRAG tool (semantic retrieval +
 * answer synthesis over an in-memory vector store).
 *
 * This is the one capability neither core example shows: a real RETRIEVAL tool
 * wired into a distributed actor. Retrieval happens INSIDE the tool (the corpus
 * is embedded there), so only the question + answer cross the messaging caps.
 *
 * NOTE: SimpleRAG needs an OpenAI key for embeddings + answer synthesis, even if
 * your chat LLM is OpenRouter/local. Set OPENAI_API_KEY (or RAG_OPENAI_API_KEY).
 */
import type { KaibanAgentConfig } from "kaiban-distributed";
import { buildLLMConfig } from "kaiban-distributed/shared";
import { SimpleRAG } from "@kaibanjs/tools/simple-rag";
import { PRODUCT_KB } from "./knowledge";

export const SPECIALIST_QUEUE = "kaiban-agents-specialist";

const llmConfig = buildLLMConfig();

/** KaibanJS/LangChain tools are structurally compatible; cast at the seam. */
type AgentTools = NonNullable<KaibanAgentConfig["tools"]>;

const ragKey = process.env["RAG_OPENAI_API_KEY"] ?? process.env["OPENAI_API_KEY"];
const content = process.env["RAG_CONTENT"] ?? PRODUCT_KB;

/**
 * Build the RAG tool when an OpenAI (embeddings) key is available; otherwise the
 * specialist still runs but answers from the model's own knowledge (no retrieval).
 */
function buildRagTool(): AgentTools | undefined {
  if (!ragKey) {
    console.warn(
      "[RAG] No OPENAI_API_KEY/RAG_OPENAI_API_KEY set — running WITHOUT retrieval " +
        "(answers will not be grounded in the knowledge base).",
    );
    return undefined;
  }
  return [
    new SimpleRAG({ OPENAI_API_KEY: ragKey, content }),
  ] as unknown as AgentTools;
}

const ragTool = buildRagTool();

/** The Product Specialist — answers strictly from the knowledge base. */
export const specialistConfig: KaibanAgentConfig = {
  name: "Iris",
  role: "Product Specialist",
  goal: "Answer customer questions about the product accurately and concisely, using the knowledge-base retrieval tool. If the answer is not in the knowledge base, say so rather than guessing.",
  background:
    "A meticulous product support specialist for the Nimbus T3 smart thermostat. Always grounds answers in the knowledge base via the RAG tool, cites the relevant section, and never invents specs, warranty terms, or compatibility claims.",
  maxIterations: 8,
  forceFinalAnswer: true,
  ...(ragTool ? { tools: ragTool } : {}),
  ...(llmConfig ? { llmConfig } : {}),
};

/** Agent roster for the board. */
export const RAG_AGENTS = [
  { agentId: "specialist", name: "Iris", role: "Product Specialist" },
];

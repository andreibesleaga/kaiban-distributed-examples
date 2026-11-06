/**
 * Board roster for this example. Kept free of side effects: `team-config.ts`
 * builds the search/RAG tools when it loads, which only the worker nodes need.
 */
/** Agent roster for the board. */
export const RAG_AGENTS = [
  { agentId: "specialist", name: "Iris", role: "Product Specialist" },
];

/**
 * Board roster for this example. Kept free of side effects: `team-config.ts`
 * builds the search/RAG tools when it loads, which only the worker nodes need.
 */
/** Agent roster for the board (drives the Kanban swim-lanes). */
export const TRIP_AGENTS = [
  { agentId: "city-selector", name: "Peter Atlas", role: "City Selector" },
  { agentId: "local-expert", name: "Sophia Lore", role: "Local Expert" },
  { agentId: "concierge", name: "Maxwell Journey", role: "Travel Concierge" },
];

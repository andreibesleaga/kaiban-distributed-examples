/**
 * AgentCard skill parsing (A2A v0.3).
 *
 * A2A v0.3 made `capabilities` an object and moved an agent's discrete abilities
 * into `skills: Array<{ id?, name? }>`. This pure helper reads ONLY `skills[]`
 * and returns a joined `name ?? id` label, ignoring blanks — a card with no
 * skills yields '' instead of throwing.
 *
 * (Copied from the kaiban-distributed core example helpers; not part of the
 * published package API, so it lives here in the showcase repo.)
 */
export interface AgentCardSkills {
  skills?: Array<{ id?: string; name?: string }>;
}

/** Join an AgentCard's `skills[]` into a `name ?? id` comma-separated label. */
export function parseAgentCardSkills(card: AgentCardSkills): string {
  return (card.skills ?? [])
    .map((s) => s.name ?? s.id)
    .filter((label): label is string => Boolean(label))
    .join(", ");
}

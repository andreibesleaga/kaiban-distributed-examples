/**
 * Environment readers shared by every example.
 *
 * Docker Compose passes `NAME: ${NAME:-}` for optional inputs, so an unset
 * variable arrives as the EMPTY string. `??` does not replace an empty string,
 * so every optional input is read through these helpers, which treat an empty
 * or whitespace-only value exactly like an unset one.
 */

type Env = Record<string, string | undefined>;

/** The trimmed value of `name`, or `fallback` when it is unset, empty or blank. */
export function envOr(name: string, fallback: string, env: Env = process.env): string {
  const value = env[name]?.trim();
  return value ? value : fallback;
}

/** The first non-blank value among `names`, or `undefined` when none is set. */
export function firstEnv(names: string[], env: Env = process.env): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** A positive whole number from `name`; `fallback` when unset, blank or not a number. */
export function envInt(name: string, fallback: number, env: Env = process.env): number {
  const parsed = Number.parseInt(env[name]?.trim() ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

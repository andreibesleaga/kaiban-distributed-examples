/**
 * Prompt on the terminal. When the readline interface is already closed (no
 * usable stdin: a Job or detached run decided from the board) there is nobody
 * to ask, so the answer is "" and a REVISE re-runs without notes instead of
 * crashing with ERR_USE_AFTER_CLOSE.
 */
/** The one method of `readline.Interface` that `ask` uses. */
export interface Asker {
  question(query: string, callback: (answer: string) => void): void;
}

export function ask(rl: Asker, question: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      rl.question(question, (answer) => resolve(answer.trim()));
    } catch {
      resolve("");
    }
  });
}

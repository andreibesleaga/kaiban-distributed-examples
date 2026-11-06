/**
 * Prompt on the terminal. The answer is "" (a REVISE re-runs without notes)
 * when there is nobody to ask: the readline interface is already closed (a Job
 * or detached run decided from the board; `question` would throw
 * ERR_USE_AFTER_CLOSE), or stdin ends while the prompt is open (readline emits
 * `close` without answering). An emergency STOP ALL while the prompt is open
 * rejects with the stop's reason, so the orchestrator ends STOPPED (exit 2)
 * instead of waiting for input.
 */
/** The methods of `readline.Interface` that `ask` uses. */
export interface Asker {
  question(query: string, callback: (answer: string) => void): void;
  once?(event: "close", listener: () => void): unknown;
  off?(event: "close", listener: () => void): unknown;
}

export function ask(rl: Asker, question: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onClose = (): void => settle(() => resolve(""));
    const onAbort = (): void => settle(() => reject(signal?.reason));
    const settle = (end: () => void): void => {
      rl.off?.("close", onClose);
      signal?.removeEventListener("abort", onAbort);
      end();
    };
    rl.once?.("close", onClose);
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      rl.question(question, (answer) => settle(() => resolve(answer.trim())));
    } catch {
      settle(() => resolve(""));
    }
  });
}

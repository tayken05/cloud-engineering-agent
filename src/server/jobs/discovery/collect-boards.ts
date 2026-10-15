import {
  JOB_DISCOVERY_CONCURRENCY,
  JOB_DISCOVERY_RETRY_DELAY_MS,
  VERIFIED_EMPLOYER_BOARDS,
} from "./employer-registry.ts";
import { fetchEmployerBoard, ProviderAdapterError } from "./provider-adapters.ts";
import type { BoardFailure, BoardResult, DiscoveryResult, EmployerBoard, ProviderJob } from "./types.ts";

type FetchBoard = (board: EmployerBoard, signal?: AbortSignal) => Promise<readonly ProviderJob[]>;

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

async function collectOne(board: EmployerBoard, fetchBoard: FetchBoard, signal?: AbortSignal): Promise<BoardResult | BoardFailure> {
  let lastReason: BoardFailure["reason"] = "network";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const jobs = await fetchBoard(board, signal);
      return Object.freeze({ board, jobs });
    } catch (error) {
      lastReason = error instanceof ProviderAdapterError ? error.reason : "network";
      if (lastReason === "aborted" || attempt === 1) break;
      await delay(JOB_DISCOVERY_RETRY_DELAY_MS, signal);
    }
  }
  return Object.freeze({ board, reason: lastReason });
}

export async function collectEmployerBoards(
  boards: readonly EmployerBoard[] = VERIFIED_EMPLOYER_BOARDS,
  options: Readonly<{ fetchBoard?: FetchBoard; signal?: AbortSignal }> = {},
): Promise<DiscoveryResult> {
  const fetchBoard = options.fetchBoard ?? ((board, signal) => fetchEmployerBoard(board, { signal }));
  const successes: BoardResult[] = [];
  const failures: BoardFailure[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < boards.length) {
      const board = boards[cursor];
      cursor += 1;
      if (!board) return;
      const result = await collectOne(board, fetchBoard, options.signal);
      if ("jobs" in result) successes.push(result);
      else failures.push(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOB_DISCOVERY_CONCURRENCY, boards.length) }, () => worker()));
  return Object.freeze({ failures, successes });
}

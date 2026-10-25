"use client";

// Actions taken in this browser, newest first. Kept in localStorage: it is a per-viewer
// convenience, so it never leaves the browser and the app works the same without it
// (private windows, blocked storage).

export interface HistoryEntry {
  ts: number;
  title: string;
  detail: string;
  hash?: string;
  trade?: string;
}

const KEY = "avocate.history.v1";
const MAX = 50;
const EVENT = "avocate-history";

export function readHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addHistory(entry: HistoryEntry): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([entry, ...readHistory()].slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable: the action itself already succeeded on chain.
  }
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Nothing to clear.
  }
}

export function onHistoryChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  // Another tab of the app changed it.
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

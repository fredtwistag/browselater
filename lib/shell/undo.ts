"use client";

let lastUndo: { fn: () => void; expiresAt: number } | null = null;
const TTL_MS = 6000;

export function registerUndo(fn: () => void): void {
  lastUndo = { fn, expiresAt: Date.now() + TTL_MS };
}

export function runUndoIfPending(): boolean {
  if (!lastUndo) return false;
  if (Date.now() > lastUndo.expiresAt) {
    lastUndo = null;
    return false;
  }
  const { fn } = lastUndo;
  lastUndo = null;
  fn();
  return true;
}

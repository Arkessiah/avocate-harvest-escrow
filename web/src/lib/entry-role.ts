"use client";

// The role picked on the entry screen. It only decides what the header shows: a person in
// one role sees their screen, Avocate's admin sees every screen. It grants nothing; each
// action is still authorised by the contracts.
export const ENTRY_ROLES = ["buyer", "farmer", "pool", "validator", "admin"] as const;
export type EntryRole = (typeof ENTRY_ROLES)[number];

const KEY = "avocate.entry-role.v1";
const EVENT = "avocate-entry-role";

export function readEntryRole(): EntryRole | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return (ENTRY_ROLES as readonly string[]).includes(v ?? "") ? (v as EntryRole) : null;
  } catch {
    return null;
  }
}

export function setEntryRole(role: EntryRole | null): void {
  try {
    if (role) window.localStorage.setItem(KEY, role);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Without storage the header simply shows every screen.
  }
}

export function onEntryRoleChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

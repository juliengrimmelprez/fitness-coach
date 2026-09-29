"use client";

import type { Session } from "@supabase/supabase-js";

/**
 * "Continue as" accounts remembered on this device (max 6).
 * Supabase rotates refresh tokens, so the active account's tokens are re-saved on every
 * auth change (see AccountSync); inactive accounts keep their last token until used.
 */
export interface RememberedAccount {
  userId: string;
  email: string;
  provider: "email" | "google";
  accessToken: string | null;
  refreshToken: string | null;
  lastUsed: number;
}

const KEY = "plate.remembered-accounts.v1";
const MAX = 6;
const CHANGE_EVENT = "plate:accounts-changed";

/** Raw stored JSON; a stable string snapshot for useSyncExternalStore. */
export function accountsSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function subscribeAccounts(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function parseAccounts(raw: string): RememberedAccount[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadAccounts(): RememberedAccount[] {
  return parseAccounts(accountsSnapshot());
}

function saveAccounts(accounts: RememberedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts.slice(0, MAX)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage unavailable (private mode): the switcher just stays empty.
  }
}

export function rememberSession(session: Session) {
  const email = session.user.email;
  if (!email) return;
  const provider = session.user.app_metadata?.provider === "google" ? "google" : "email";
  const others = loadAccounts().filter((a) => a.userId !== session.user.id);
  saveAccounts([
    {
      userId: session.user.id,
      email,
      provider,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      lastUsed: Date.now(),
    },
    ...others,
  ]);
}

/** After signing out, keep the row (for one-tap email prefill) but drop its now-revoked tokens. */
export function clearTokens(userId: string) {
  saveAccounts(
    loadAccounts().map((a) => (a.userId === userId ? { ...a, accessToken: null, refreshToken: null } : a)),
  );
}

export function forgetAccount(userId: string) {
  saveAccounts(loadAccounts().filter((a) => a.userId !== userId));
}

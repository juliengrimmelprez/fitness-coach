"use client";

import { supabaseBrowser } from "./supabase/client";

/** Small per-user cache for AI outputs that shouldn't be regenerated (and paid for) on every visit. */
export async function readCache<T>(kind: string, key: string): Promise<T | null> {
  const { data, error } = await supabaseBrowser().from("ai_cache").select("content").eq("kind", kind).eq("key", key).maybeSingle();
  if (error || !data) return null;
  return data.content as T;
}

export async function writeCache(userId: string, kind: string, key: string, content: unknown): Promise<void> {
  await supabaseBrowser()
    .from("ai_cache")
    .upsert({ user_id: userId, kind, key, content, created_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
}

"use client";

import { useEffect } from "react";
import { rememberSession } from "@/lib/accounts";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Keeps the "Continue as" entry for the signed-in account up to date as Supabase rotates its tokens. */
export function AccountSync() {
  useEffect(() => {
    const supabase = supabaseBrowser();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        rememberSession(session);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}

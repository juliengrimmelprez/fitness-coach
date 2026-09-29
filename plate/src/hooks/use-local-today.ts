"use client";

import { useSyncExternalStore } from "react";
import { localDateString } from "@/lib/slots";

const noopSubscribe = () => () => {};

/**
 * Today's date (YYYY-MM-DD) in the phone's timezone. Returns null during server rendering,
 * because the server may be in a different timezone than the user.
 */
export function useLocalToday(): string | null {
  return useSyncExternalStore(noopSubscribe, () => localDateString(), () => null);
}

"use client";

import { createContext, useContext, useState } from "react";
import type { Profile } from "@/lib/types";

interface ProfileContextValue {
  profile: Profile;
  setProfile: (p: Profile) => void;
  email: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ initial, email, children }: { initial: Profile; email: string; children: React.ReactNode }) {
  const [profile, setProfile] = useState(initial);
  return <ProfileContext value={{ profile, setProfile, email }}>{children}</ProfileContext>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}

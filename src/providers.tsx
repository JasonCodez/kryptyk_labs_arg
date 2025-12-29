"use client";

import { SessionProvider } from "next-auth/react";
import { useUserPreferences } from "@/lib/useUserPreferences";

function PreferenceInitializer({ children }: { children: React.ReactNode }) {
  useUserPreferences();
  return children;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PreferenceInitializer>{children}</PreferenceInitializer>
    </SessionProvider>
  );
}

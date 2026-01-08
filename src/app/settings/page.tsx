"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard since settings is no longer needed
    router.push("/dashboard");
  }, [router]);

  return null;
}

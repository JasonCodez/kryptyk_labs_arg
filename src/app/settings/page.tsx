"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UserPreferencesSettings from "@/components/UserPreferencesSettings";

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <div className="flex gap-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="p-8 max-w-5xl mx-auto">
        <UserPreferencesSettings />
      </div>
    </main>
  );
}

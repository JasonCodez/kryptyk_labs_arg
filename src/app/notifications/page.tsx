"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";

export default function NotificationsPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin');
  }, [status, router]);

  return (
    <div style={{ backgroundColor: '#020202' }} className="min-h-screen">
      <main className="pt-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">Notifications</h1>
          <p className="text-sm text-gray-400 mb-6">Your recent notifications are listed below.</p>
        </div>
        <NotificationsPanel isOpen={true} onClose={() => router.push('/dashboard')} />
      </main>
    </div>
  );
}

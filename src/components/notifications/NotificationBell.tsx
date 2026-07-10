"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationBell({ onActivate }: { onActivate?: () => void }) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30s
    const onRead = () => fetchUnreadCount();
    const onNotif = (e: any) => {
      try {
        // Increment immediately and also refresh to be safe
        setUnreadCount((n) => n + 1);
        fetchUnreadCount();
      } catch {
        // ignore
      }
    };
    window.addEventListener("notificationsRead", onRead);
    window.addEventListener("notificationReceived", onNotif as EventListener);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
      abortRef.current = null;
      window.removeEventListener("notificationsRead", onRead);
      window.removeEventListener("notificationReceived", onNotif as EventListener);
    };
  }, []);

  const fetchUnreadCount = async () => {
    // Abort any previous in-flight request (e.g., during fast refresh / navigation).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/user/notifications?limit=1&skip=0&unreadOnly=true", {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        setUnreadCount(0);
        return;
      }

      const data = await response.json();
      const unread = typeof data?.unreadCount === "number" ? data.unreadCount : 0;
      setUnreadCount(unread);
    } catch (error) {
      // Ignore cancellations (common during route changes / fast refresh).
      if (error && typeof error === "object" && "name" in error && (error as any).name === "AbortError") {
        return;
      }
      console.warn("Failed to fetch unread count:", error);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onActivate?.();
          router.push('/notifications');
        }}
        className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors group"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-400 group-hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications open via dedicated page */}
    </>
  );
}

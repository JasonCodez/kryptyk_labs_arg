"use client";

import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch("/api/user/activity?limit=1&skip=0");
      const data = await response.json();
      // Count unread notifications from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const unread = data.activities.filter(
        (a: any) => new Date(a.createdAt) > oneDayAgo
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
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

      <NotificationsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

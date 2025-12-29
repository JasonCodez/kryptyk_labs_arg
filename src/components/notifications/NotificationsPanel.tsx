"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Activity } from "@prisma/client";
import {
  X,
  CheckCircle,
  AlertCircle,
  Lock,
  Zap,
  Trash2,
} from "lucide-react";

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({
  isOpen,
  onClose,
}: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/activity?limit=10&skip=0");
      const data = await response.json();
      setNotifications(data.activities);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      // Optimistic update
      setNotifications(notifications.filter((n) => n.id !== id));

      // API call
      const response = await fetch(`/api/user/activity/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Revert on error
        await fetchNotifications();
        console.error("Failed to delete notification");
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
      // Revert on error
      await fetchNotifications();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-screen w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Notifications</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <CheckCircle className="w-12 h-12 text-green-400/50" />
              <p className="text-gray-400">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {notification.type === "security" && (
                        <Lock className="w-5 h-5 text-yellow-400" />
                      )}
                      {notification.type === "subscription" && (
                        <Zap className="w-5 h-5 text-[#3891A6]" />
                      )}
                      {notification.type === "success" && (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                      {notification.type === "error" && (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {notification.title}
                      </p>
                      {notification.description && (
                        <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                          {notification.description}
                        </p>
                      )}
                      <span className="text-xs text-gray-500 mt-2 block">
                        {format(
                          new Date(notification.createdAt),
                          "MMM d, HH:mm"
                        )}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotification(notification.id);
                      }}
                      className="flex-shrink-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700 rounded-lg"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4">
          <a
            href="/dashboard/activity"
            onClick={onClose}
            className="block text-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            View All Activities
          </a>
        </div>
      </div>
    </div>
  );
}

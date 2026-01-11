"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";

// Local Activity type — Prisma does not export `Activity` here.
interface Activity {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  relatedId?: string | null;
  relatedType?: string | null;
  isRead?: boolean;
  createdAt: string | Date;
}
import {
  X,
  CheckCircle,
  AlertCircle,
  Lock,
  Zap,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ActionModal from "@/components/ActionModal";

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
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);
  const [modalVariant, setModalVariant] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    if (isOpen) {
      // Mark all notifications as read when the panel opens so the bell counter clears.
      (async () => {
        try {
          await fetch("/api/user/notifications/read", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllAsRead: true }),
          });
          // Notify other components (e.g., the bell) to refresh their unread counts.
          window.dispatchEvent(new Event("notificationsRead"));
        } catch (err) {
          // Non-fatal
          console.warn("Failed to mark notifications read:", err);
        }

        // Fetch notifications to show updated read state
        await fetchNotifications();
      })();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/notifications?limit=10&skip=0");
      const data = await response.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
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

      // API call: permanently delete this notification
      const response = await fetch(`/api/user/notifications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id] }),
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
                  className="p-3 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
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
                        {notification.message && (
                          <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                            {notification.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2">
                      <span className="text-xs text-gray-500">
                        {format(new Date(notification.createdAt), "MMM d, HH:mm")}
                      </span>

                      <div className="flex items-center gap-2">
                        {notification.type === "team_update" && notification.relatedId && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await fetch(`/api/teams/${notification.relatedId}`);
                                if (res.ok) {
                                  onClose();
                                  router.push(`/teams/${notification.relatedId}#applications`);
                                } else {
                                  setModalTitle('Team not found');
                                  setModalMessage('This team no longer exists.');
                                  setModalVariant('error');
                                  setModalOpen(true);
                                }
                              } catch (err) {
                                setModalTitle('Unable to open team');
                                setModalMessage('There was a problem locating this team.');
                                setModalVariant('error');
                                setModalOpen(true);
                              }
                            }}
                            className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                            title="Review application"
                          >
                            Review
                          </button>
                        )}

                        {notification.type === "puzzle_released" && notification.relatedId && (
                          <a
                            href={`/puzzles#puzzle-${notification.relatedId}`}
                            onClick={onClose}
                            className="px-2 py-0.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                            title="View puzzle card"
                          >
                            View
                          </a>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(notification.id);
                          }}
                          className="p-1 hover:bg-slate-700 rounded"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
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
      <ActionModal
        isOpen={modalOpen}
        title={modalTitle}
        message={modalMessage}
        variant={modalVariant}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, Settings as SettingsIcon, Check, X } from "lucide-react";

interface NotificationPreferences {
  id: string;
  emailOnPuzzleRelease: boolean;
  emailOnAchievement: boolean;
  emailOnTeamUpdate: boolean;
  emailOnLeaderboard: boolean;
  emailOnSystem: boolean;
  enableDigest: boolean;
  digestFrequency: string;
  emailNotificationsEnabled: boolean;
}

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    try {
      const response = await fetch("/api/user/notification-preferences");
      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error("Failed to fetch notification preferences:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updatePreferences(updates: Partial<NotificationPreferences>) {
    setSaving(true);
    setSuccess(false);
    try {
      const response = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8" style={{ color: "#FDE74C" }}>
        Loading notification settings...
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-8" style={{ color: "#AB9F9D" }}>
        Failed to load notification settings
      </div>
    );
  }

  const notificationOptions = [
    {
      key: "emailOnPuzzleRelease",
      label: "New Puzzle Releases",
      description: "Get notified when a new puzzle is published",
      icon: "🎯",
      enabled: preferences.emailOnPuzzleRelease,
    },
    {
      key: "emailOnAchievement",
      label: "Achievement Unlocked",
      description: "Get notified when you unlock an achievement",
      icon: "🏆",
      enabled: preferences.emailOnAchievement,
    },
    {
      key: "emailOnTeamUpdate",
      label: "Team Updates",
      description: "Get notified about team activities and updates",
      icon: "👥",
      enabled: preferences.emailOnTeamUpdate,
    },
    {
      key: "emailOnLeaderboard",
      label: "Leaderboard Changes",
      description: "Get notified when your rank changes",
      icon: "📊",
      enabled: preferences.emailOnLeaderboard,
    },
    {
      key: "emailOnSystem",
      label: "System Notifications",
      description: "Get important system and security notifications",
      icon: "⚙️",
      enabled: preferences.emailOnSystem,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Master Switch */}
      <div
        className="p-6 rounded-lg border"
        style={{
          backgroundColor: "rgba(56, 145, 166, 0.08)",
          borderColor: "#3891A6",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail size={24} style={{ color: "#FDE74C" }} />
            <div>
              <h3 className="font-semibold text-white">Email Notifications</h3>
              <p style={{ color: "#AB9F9D" }} className="text-sm">
                Manage all email notification settings
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              updatePreferences({
                ...preferences,
                emailNotificationsEnabled: !preferences.emailNotificationsEnabled,
              })
            }
            disabled={saving}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: preferences.emailNotificationsEnabled ? "#38D399" : "#AB9F9D",
              color: "#020202",
            }}
          >
            {preferences.emailNotificationsEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {/* Individual Notifications */}
      <div className="space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Bell size={20} style={{ color: "#FDE74C" }} />
          Notification Types
        </h3>

        {notificationOptions.map((option) => (
          <div
            key={option.key}
            className="p-4 rounded-lg border transition-all"
            style={{
              backgroundColor: option.enabled
                ? "rgba(56, 211, 153, 0.08)"
                : "rgba(171, 159, 157, 0.05)",
              borderColor: option.enabled ? "#38D399" : "#AB9F9D",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{option.icon}</span>
                <div>
                  <h4 className="font-semibold text-white">{option.label}</h4>
                  <p style={{ color: "#AB9F9D" }} className="text-sm">
                    {option.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  updatePreferences({
                    ...preferences,
                    [option.key]: !option.enabled,
                  })
                }
                disabled={saving || !preferences.emailNotificationsEnabled}
                className="ml-4 px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                style={{
                  backgroundColor: option.enabled
                    ? "rgba(56, 211, 153, 0.2)"
                    : "rgba(171, 159, 157, 0.1)",
                  color: option.enabled ? "#38D399" : "#AB9F9D",
                  opacity: preferences.emailNotificationsEnabled ? 1 : 0.5,
                }}
              >
                {option.enabled ? (
                  <>
                    <Check size={16} /> On
                  </>
                ) : (
                  <>
                    <X size={16} /> Off
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Digest Settings */}
      <div
        className="p-6 rounded-lg border space-y-4"
        style={{
          backgroundColor: "rgba(253, 231, 76, 0.08)",
          borderColor: "#FDE74C",
        }}
      >
        <div className="flex items-center gap-2">
          <SettingsIcon size={20} style={{ color: "#FDE74C" }} />
          <h3 className="font-semibold text-white">Email Digest</h3>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.enableDigest}
              onChange={(e) =>
                updatePreferences({
                  ...preferences,
                  enableDigest: e.target.checked,
                })
              }
              disabled={saving}
              className="w-4 h-4 rounded"
              style={{
                accentColor: "#FDE74C",
              }}
            />
            <span style={{ color: "#DDDBF1" }}>
              Combine notifications into a weekly digest email
            </span>
          </label>
        </div>

        {preferences.enableDigest && (
          <div>
            <label style={{ color: "#DDDBF1" }} className="text-sm">
              Digest Frequency:
            </label>
            <select
              value={preferences.digestFrequency}
              onChange={(e) =>
                updatePreferences({
                  ...preferences,
                  digestFrequency: e.target.value,
                })
              }
              disabled={saving}
              className="w-full mt-2 px-4 py-2 rounded-lg border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.1)",
                borderColor: "#3891A6",
                color: "#DDDBF1",
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div
          className="p-4 rounded-lg text-center font-semibold animate-in fade-in"
          style={{
            backgroundColor: "rgba(56, 211, 153, 0.2)",
            color: "#38D399",
          }}
        >
          ✓ Notification settings updated successfully
        </div>
      )}
    </div>
  );
}

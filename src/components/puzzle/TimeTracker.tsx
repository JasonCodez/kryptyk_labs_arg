"use client";

import React, { useEffect, useState } from "react";
import { Clock, Zap } from "lucide-react";

interface SessionLog {
  id: string;
  sessionStart: string | Date;
  sessionEnd: string | Date | null;
  durationSeconds: number | null;
  attemptMade: boolean;
  wasSuccessful: boolean;
}

interface TimeTrackerProps {
  totalTimeSpent: number; // In seconds
  currentSessionStart?: string | Date | null;
  sessionLogs: SessionLog[];
  isActive?: boolean;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export default function TimeTracker({
  totalTimeSpent,
  currentSessionStart,
  sessionLogs,
  isActive = false,
}: TimeTrackerProps) {
  const [currentSessionTime, setCurrentSessionTime] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Track current session time
  useEffect(() => {
    if (!currentSessionStart || !isActive) return;

    const interval = setInterval(() => {
      const now = new Date();
      const start =
        typeof currentSessionStart === "string"
          ? new Date(currentSessionStart)
          : currentSessionStart;
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
      setCurrentSessionTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSessionStart, isActive]);

  const totalWithCurrent = totalTimeSpent + currentSessionTime;
  const successfulSessions = sessionLogs.filter((s) => s.wasSuccessful).length;
  const avgSessionTime =
    sessionLogs.length > 0
      ? Math.round(
          sessionLogs.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) /
            sessionLogs.length
        )
      : 0;

  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{
        backgroundColor: "rgba(56, 145, 166, 0.08)",
        borderColor: "#3891A6",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={18} style={{ color: "#3891A6" }} />
          <div className="text-left">
            <p className="font-semibold" style={{ color: "#3891A6" }}>
              Time Spent
            </p>
            {isActive && currentSessionStart && (
              <p className="text-xs" style={{ color: "#FDE74C" }}>
                Session: {formatTime(currentSessionTime)}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold" style={{ color: "#FDE74C" }}>
            {formatTime(totalWithCurrent)}
          </p>
          {sessionLogs.length > 0 && (
            <p className="text-xs" style={{ color: "#AB9F9D" }}>
              {sessionLogs.length} session{sessionLogs.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </button>

      {/* Stats Summary */}
      {isExpanded && (
        <div className="space-y-2 pt-2" style={{ borderTopColor: "#3891A6", borderTopWidth: "1px" }}>
          <div className="grid grid-cols-2 gap-2">
            {/* Average Session Time */}
            <div
              className="p-2 rounded text-sm"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
            >
              <p style={{ color: "#AB9F9D" }} className="text-xs">
                Avg Session
              </p>
              <p style={{ color: "#3891A6" }} className="font-semibold">
                {formatTime(avgSessionTime)}
              </p>
            </div>

            {/* Success Rate */}
            <div
              className="p-2 rounded text-sm"
              style={{ backgroundColor: "rgba(56, 211, 153, 0.1)" }}
            >
              <p style={{ color: "#AB9F9D" }} className="text-xs">
                Successful
              </p>
              <p style={{ color: "#38D399" }} className="font-semibold">
                {successfulSessions}/{sessionLogs.length}
              </p>
            </div>
          </div>

          {/* Session List */}
          {sessionLogs.length > 0 && (
            <div className="space-y-2 mt-3">
              <p style={{ color: "#AB9F9D" }} className="text-xs font-semibold">
                Recent Sessions
              </p>
              {sessionLogs.slice(0, 5).map((session) => {
                const start =
                  typeof session.sessionStart === "string"
                    ? new Date(session.sessionStart)
                    : session.sessionStart;
                const duration = session.durationSeconds || 0;

                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-2 rounded border"
                    style={{
                      backgroundColor: session.wasSuccessful
                        ? "rgba(56, 211, 153, 0.08)"
                        : "rgba(171, 159, 157, 0.05)",
                      borderColor: session.wasSuccessful
                        ? "rgba(56, 211, 153, 0.2)"
                        : "rgba(171, 159, 157, 0.2)",
                    }}
                  >
                    <div>
                      <p className="text-xs" style={{ color: "#DDDBF1" }}>
                        {start.toLocaleTimeString()}
                      </p>
                      {session.attemptMade && (
                        <p className="text-xs" style={{ color: "#AB9F9D" }}>
                          {session.wasSuccessful
                            ? "✓ Successful"
                            : "~ Attempt made"}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: "#3891A6" }}
                      >
                        {formatTime(duration)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

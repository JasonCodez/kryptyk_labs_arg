"use client";

import React from "react";
import { Target, TrendingUp, Zap } from "lucide-react";

interface AttemptStatsProps {
  attempts: number;
  successfulAttempts: number;
  averageTimePerAttempt: number | null; // In seconds
  totalAttempts: number;
}

export default function AttemptStats({
  attempts,
  successfulAttempts,
  averageTimePerAttempt,
  totalAttempts,
}: AttemptStatsProps) {
  const successRate =
    attempts > 0 ? Math.round((successfulAttempts / attempts) * 100) : 0;
  const failedAttempts = attempts - successfulAttempts;

  const formatTime = (seconds: number | null): string => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Animation variants
  const cardVariants = {
    initial: { opacity: 0, scale: 0.9, y: 10 },
    animate: (i: number) => ({
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.4,
        ease: "easeOut",
      },
    }),
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold" style={{ color: "#DDDBF1" }}>
        Attempt Stats
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Total Attempts */}
        <div
          className="p-4 rounded-lg border transition-all hover:scale-105"
          style={{
            backgroundColor: "rgba(250, 126, 89, 0.08)",
            borderColor: "#FA7E59",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} style={{ color: "#FA7E59" }} />
            <p style={{ color: "#AB9F9D" }} className="text-xs">
              Total Attempts
            </p>
          </div>
          <p style={{ color: "#FA7E59" }} className="text-2xl font-bold">
            {attempts}
          </p>
          {totalAttempts > attempts && (
            <p style={{ color: "#AB9F9D" }} className="text-xs mt-1">
              {totalAttempts - attempts} available
            </p>
          )}
        </div>

        {/* Success Rate */}
        <div
          className="p-4 rounded-lg border transition-all hover:scale-105"
          style={{
            backgroundColor: "rgba(56, 211, 153, 0.08)",
            borderColor: "#38D399",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} style={{ color: "#38D399" }} />
            <p style={{ color: "#AB9F9D" }} className="text-xs">
              Success Rate
            </p>
          </div>
          <p style={{ color: "#38D399" }} className="text-2xl font-bold">
            {successRate}%
          </p>
          <p style={{ color: "#AB9F9D" }} className="text-xs mt-1">
            {successfulAttempts} of {attempts}
          </p>
        </div>

        {/* Successful Attempts */}
        <div
          className="p-4 rounded-lg border transition-all hover:scale-105"
          style={{
            backgroundColor: "rgba(56, 211, 153, 0.08)",
            borderColor: "#38D399",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} style={{ color: "#38D399" }} />
            <p style={{ color: "#AB9F9D" }} className="text-xs">
              Successful
            </p>
          </div>
          <p style={{ color: "#38D399" }} className="text-2xl font-bold">
            {successfulAttempts}
          </p>
          {failedAttempts > 0 && (
            <p style={{ color: "#AB9F9D" }} className="text-xs mt-1">
              {failedAttempts} failed attempt{failedAttempts !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Average Time Per Attempt */}
        <div
          className="p-4 rounded-lg border transition-all hover:scale-105"
          style={{
            backgroundColor: "rgba(253, 231, 76, 0.08)",
            borderColor: "#FDE74C",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} style={{ color: "#FDE74C" }} />
            <p style={{ color: "#AB9F9D" }} className="text-xs">
              Avg Per Attempt
            </p>
          </div>
          <p style={{ color: "#FDE74C" }} className="text-xl font-bold">
            {formatTime(averageTimePerAttempt)}
          </p>
        </div>
      </div>

      {/* Performance Indicator */}
      <div
        className="p-3 rounded-lg text-sm text-center"
        style={{
          backgroundColor:
            successRate >= 75
              ? "rgba(56, 211, 153, 0.1)"
              : successRate >= 50
                ? "rgba(253, 231, 76, 0.1)"
                : "rgba(250, 126, 89, 0.1)",
          borderLeft: `4px solid ${
            successRate >= 75
              ? "#38D399"
              : successRate >= 50
                ? "#FDE74C"
                : "#FA7E59"
          }`,
        }}
      >
        {successRate >= 75 ? (
          <span style={{ color: "#38D399" }}>
            ✓ Great performance! You're solving this efficiently.
          </span>
        ) : successRate >= 50 ? (
          <span style={{ color: "#FDE74C" }}>
            ~ Keep practicing! You're making progress.
          </span>
        ) : attempts > 0 ? (
          <span style={{ color: "#FA7E59" }}>
            ~ Don't give up! Try different approaches.
          </span>
        ) : (
          <span style={{ color: "#AB9F9D" }}>No attempts yet.</span>
        )}
      </div>
    </div>
  );
}

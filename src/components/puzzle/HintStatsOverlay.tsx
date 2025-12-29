"use client";

import React from "react";
import { TrendingUp, Zap, Clock, Target } from "lucide-react";

interface HintWithStats {
  id: string;
  text: string;
  order: number;
  costPoints: number;
  stats: {
    totalUsages: number;
    timesLeadToSolve: number;
    successRate: number;
    averageTimeToSolve: number | null;
  };
}

interface HintStatsOverlayProps {
  hints: HintWithStats[];
}

export default function HintStatsOverlay({ hints }: HintStatsOverlayProps) {
  const totalUsages = hints.reduce((sum, h) => sum + h.stats.totalUsages, 0);
  const totalSuccesses = hints.reduce((sum, h) => sum + h.stats.timesLeadToSolve, 0);
  const avgTimeToSolve =
    hints
      .filter((h) => h.stats.averageTimeToSolve)
      .reduce((sum, h) => sum + (h.stats.averageTimeToSolve || 0), 0) /
      hints.filter((h) => h.stats.averageTimeToSolve).length || 0;

  const averageCostPerHint =
    hints.length > 0
      ? hints.reduce((sum, h) => sum + h.costPoints, 0) / hints.length
      : 0;

  // Find most effective hint
  const mostEffectiveHint = hints.reduce((best, current) => {
    const currentScore =
      current.stats.totalUsages > 0 ? current.stats.timesLeadToSolve / current.stats.totalUsages : 0;
    const bestScore =
      best.stats.totalUsages > 0 ? best.stats.timesLeadToSolve / best.stats.totalUsages : 0;
    return currentScore > bestScore ? current : best;
  }, hints[0]);

  const mostUsedHint = hints.reduce((best, current) =>
    current.stats.totalUsages > best.stats.totalUsages ? current : best
  , hints[0]);

  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{
        backgroundColor: "rgba(56, 145, 166, 0.08)",
        borderColor: "#3891A6",
      }}
    >
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} style={{ color: "#3891A6" }} />
        <h3 className="font-semibold" style={{ color: "#3891A6" }}>
          Hints Effectiveness Report
        </h3>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Usages */}
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: "rgba(253, 231, 76, 0.1)" }}
        >
          <p className="text-xs" style={{ color: "#AB9F9D" }}>
            Total Uses
          </p>
          <p className="text-lg font-bold" style={{ color: "#FDE74C" }}>
            {totalUsages}
          </p>
        </div>

        {/* Success Rate */}
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: "rgba(56, 211, 153, 0.1)" }}
        >
          <p className="text-xs" style={{ color: "#AB9F9D" }}>
            Led to Solve
          </p>
          <p className="text-lg font-bold" style={{ color: "#38D399" }}>
            {totalUsages > 0 ? Math.round((totalSuccesses / totalUsages) * 100) : 0}%
          </p>
        </div>

        {/* Avg Time to Solve */}
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
        >
          <p className="text-xs" style={{ color: "#AB9F9D" }}>
            Avg Time to Solve
          </p>
          <p className="text-lg font-bold" style={{ color: "#3891A6" }}>
            {Math.round(avgTimeToSolve)}s
          </p>
        </div>

        {/* Avg Hint Cost */}
        <div
          className="p-3 rounded-lg flex items-center justify-between"
          style={{ backgroundColor: "rgba(171, 159, 157, 0.1)" }}
        >
          <p className="text-xs" style={{ color: "#AB9F9D" }}>
            Avg Cost
          </p>
          <div className="flex items-center gap-1" style={{ color: "#AB9F9D" }}>
            <Zap size={14} />
            <span className="font-bold">{Math.round(averageCostPerHint)}</span>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="space-y-2 mt-4">
        {/* Most Effective */}
        {mostEffectiveHint && (
          <div
            className="p-3 rounded-lg border"
            style={{
              backgroundColor: "rgba(56, 211, 153, 0.08)",
              borderColor: "rgba(56, 211, 153, 0.3)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs" style={{ color: "#AB9F9D" }}>
                  Most Effective
                </p>
                <p className="text-sm font-semibold" style={{ color: "#38D399" }}>
                  Hint {mostEffectiveHint.order + 1}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "#AB9F9D" }}>
                  Success Rate
                </p>
                <p className="text-sm font-bold" style={{ color: "#38D399" }}>
                  {mostEffectiveHint.stats.totalUsages > 0
                    ? Math.round(
                        (mostEffectiveHint.stats.timesLeadToSolve /
                          mostEffectiveHint.stats.totalUsages) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Most Used */}
        {mostUsedHint && mostUsedHint.id !== mostEffectiveHint?.id && (
          <div
            className="p-3 rounded-lg border"
            style={{
              backgroundColor: "rgba(253, 231, 76, 0.08)",
              borderColor: "rgba(253, 231, 76, 0.3)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs" style={{ color: "#AB9F9D" }}>
                  Most Used
                </p>
                <p className="text-sm font-semibold" style={{ color: "#FDE74C" }}>
                  Hint {mostUsedHint.order + 1}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "#AB9F9D" }}>
                  Times Used
                </p>
                <p className="text-sm font-bold" style={{ color: "#FDE74C" }}>
                  {mostUsedHint.stats.totalUsages}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      <div
        className="p-3 rounded-lg text-xs"
        style={{
          backgroundColor: "rgba(10, 10, 10, 0.3)",
          borderLeftColor: "#3891A6",
          borderLeftWidth: "3px",
          color: "#DDDBF1",
        }}
      >
        <p>
          💡 <strong>Insight:</strong> {totalUsages === 0
            ? "No hints have been used yet on this puzzle."
            : totalSuccesses === 0
            ? "Hints haven't led to solutions yet. Try combining multiple hints!"
            : `On average, hints help solve this puzzle ${Math.round((totalSuccesses / totalUsages) * 100)}% of the time.`}
        </p>
      </div>
    </div>
  );
}

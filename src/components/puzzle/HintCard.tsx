"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, Zap } from "lucide-react";

interface HintWithStats {
  id: string;
  text: string;
  order: number;
  costPoints: number;
  maxUsesPerUser: number | null;
  maxUsesPerTeam: number | null;
  stats: {
    totalUsages: number;
    timesLeadToSolve: number;
    successRate: number;
    averageTimeToSolve: number | null;
  };
  userHistory: Array<{
    id: string;
    pointsCost: number;
    revealedAt: Date | string;
    solvedAt: Date | string | null;
    timeToSolve: number | null;
    leadToSolve: boolean;
  }>;
}

interface HintCardProps {
  hint: HintWithStats;
  index: number;
  isRevealed: boolean;
  isLoading?: boolean;
  onReveal: (hintId: string) => Promise<void>;
  onRateHelpfulness?: (hintId: string, wasHelpful: boolean) => void;
}

export default function HintCard({
  hint,
  index,
  isRevealed,
  isLoading = false,
  onReveal,
  onRateHelpfulness,
}: HintCardProps) {
  const [showStats, setShowStats] = useState(false);
  const [ratingGiven, setRatingGiven] = useState<boolean | null>(null);
  const hasUsedHint = hint.userHistory.length > 0;
  const userUsageCount = hint.userHistory.length;

  const handleReveal = async () => {
    await onReveal(hint.id);
  };

  const handleRate = (helpful: boolean) => {
    setRatingGiven(helpful);
    onRateHelpfulness?.(hint.id, helpful);
  };

  return (
    <div
      className="overflow-hidden rounded-lg border transition-all duration-500"
      style={{
        backgroundColor: isRevealed
          ? "rgba(253, 231, 76, 0.12)"
          : "rgba(56, 145, 166, 0.08)",
        borderColor: isRevealed ? "#FDE74C" : "#3891A6",
      }}
    >
      {/* Animated delay for staggered reveal */}
      <style>{`
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
            filter: blur(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
        
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(253, 231, 76, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(253, 231, 76, 0); }
        }
        
        .hint-card-reveal {
          animation: slideInDown 0.6s ease-out ${index * 0.1}s backwards;
        }
        
        .hint-card-loading {
          animation: shimmer 1.5s infinite;
        }
        
        .hint-card-pulse {
          animation: pulse-border 2s infinite;
        }
      `}</style>

      <div className="p-5 space-y-3">
        {/* Header with Hint Number and Cost */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm px-3 py-1 rounded-full"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.3)",
                color: "#3891A6",
              }}
            >
              Hint {index + 1}
            </span>
            {hasUsedHint && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{ backgroundColor: "rgba(56, 211, 153, 0.2)", color: "#38D399" }}
              >
                Used {userUsageCount}x
              </span>
            )}
          </div>
          <div className="flex items-center gap-1" style={{ color: "#FDE74C" }}>
            <Zap size={16} />
            <span className="font-semibold">{hint.costPoints}</span>
          </div>
        </div>

        {/* Main Content */}
        {isRevealed ? (
          <div
            className="hint-card-reveal p-4 rounded-lg"
            style={{ backgroundColor: "rgba(253, 231, 76, 0.1)" }}
          >
            {isLoading ? (
              <div className="hint-card-loading" style={{ color: "#AB9F9D" }}>
                Revealing hint...
              </div>
            ) : (
              <div>
                <p style={{ color: "#DDDBF1" }} className="text-sm leading-relaxed">
                  {hint.text}
                </p>

                {/* Helpfulness Rating */}
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className="text-xs"
                    style={{ color: "#AB9F9D" }}
                  >
                    Helpful?
                  </span>
                  <button
                    onClick={() => handleRate(true)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                    style={{
                      backgroundColor:
                        ratingGiven === true
                          ? "rgba(56, 211, 153, 0.3)"
                          : "rgba(56, 211, 153, 0.1)",
                      color: "#38D399",
                    }}
                  >
                    Yes ✓
                  </button>
                  <button
                    onClick={() => handleRate(false)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                    style={{
                      backgroundColor:
                        ratingGiven === false
                          ? "rgba(255, 107, 107, 0.3)"
                          : "rgba(255, 107, 107, 0.1)",
                      color: "#FF6B6B",
                    }}
                  >
                    No ✗
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleReveal}
            disabled={isLoading}
            className="w-full py-2 px-3 rounded-lg font-semibold transition-all duration-300 hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "rgba(56, 145, 166, 0.2)",
              color: "#3891A6",
              borderColor: "#3891A6",
              borderWidth: "1px",
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Lock size={16} />
              <span>Reveal Hint</span>
            </div>
          </button>
        )}

        {/* Stats Button */}
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full text-xs py-2 px-3 rounded-lg transition-colors hover:opacity-80"
          style={{
            backgroundColor: "rgba(171, 159, 157, 0.1)",
            color: "#AB9F9D",
          }}
        >
          {showStats ? "Hide Stats" : "View Stats"}
        </button>

        {/* Stats Panel */}
        {showStats && (
          <div
            className="p-3 rounded-lg space-y-2 border"
            style={{
              backgroundColor: "rgba(10, 10, 10, 0.5)",
              borderColor: "rgba(56, 145, 166, 0.3)",
            }}
          >
            <div className="flex justify-between text-xs">
              <span style={{ color: "#AB9F9D" }}>Total Usages:</span>
              <span style={{ color: "#DDDBF1" }} className="font-semibold">
                {hint.stats.totalUsages}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "#AB9F9D" }}>Led to Solve:</span>
              <span style={{ color: "#38D399" }} className="font-semibold">
                {hint.stats.timesLeadToSolve} ({hint.stats.successRate}%)
              </span>
            </div>
            {hint.stats.averageTimeToSolve && (
              <div className="flex justify-between text-xs">
                <span style={{ color: "#AB9F9D" }}>Avg Time to Solve:</span>
                <span style={{ color: "#3891A6" }} className="font-semibold">
                  {Math.round(hint.stats.averageTimeToSolve)}s
                </span>
              </div>
            )}
            {hint.maxUsesPerUser && (
              <div className="flex justify-between text-xs">
                <span style={{ color: "#AB9F9D" }}>Uses Left:</span>
                <span
                  style={{
                    color:
                      userUsageCount < hint.maxUsesPerUser
                        ? "#38D399"
                        : "#FF6B6B",
                  }}
                  className="font-semibold"
                >
                  {Math.max(0, hint.maxUsesPerUser - userUsageCount)} / {hint.maxUsesPerUser}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

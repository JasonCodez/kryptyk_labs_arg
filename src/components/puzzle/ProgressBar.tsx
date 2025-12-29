"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

interface ProgressBarProps {
  percentage: number; // 0-100
  solved: boolean;
  showPercentage?: boolean;
  animateOnLoad?: boolean;
}

export default function ProgressBar({
  percentage,
  solved,
  showPercentage = true,
  animateOnLoad = true,
}: ProgressBarProps) {
  const displayPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="space-y-2">
      <style>{`
        @keyframes fillProgress {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: ${displayPercentage}%;
            opacity: 1;
          }
        }
        
        @keyframes pulse-success {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56, 211, 153, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(56, 211, 153, 0); }
        }
        
        .progress-fill {
          animation: ${animateOnLoad ? "fillProgress" : "none"} 1s ease-out forwards;
          background: linear-gradient(to right, #3891A6, #38D399);
        }
        
        .progress-success {
          animation: pulse-success 2s infinite;
        }
      `}</style>

      {/* Header with Title and Percentage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold" style={{ color: "#3891A6" }}>
            Progress
          </h3>
          {solved && (
            <CheckCircle2 size={18} style={{ color: "#38D399" }} />
          )}
        </div>
        {showPercentage && (
          <span
            className="font-bold text-lg"
            style={{
              color: solved ? "#38D399" : "#FDE74C",
            }}
          >
            {displayPercentage}%
          </span>
        )}
      </div>

      {/* Progress Bar Container */}
      <div
        className="w-full h-8 rounded-full overflow-hidden border"
        style={{
          backgroundColor: "rgba(56, 145, 166, 0.1)",
          borderColor: solved ? "#38D399" : "#3891A6",
        }}
      >
        {/* Progress Fill */}
        <div
          className={`h-full progress-fill flex items-center justify-end pr-2 ${
            solved ? "progress-success" : ""
          }`}
          style={{
            width: `${displayPercentage}%`,
            background:
              solved
                ? "linear-gradient(to right, #38D399, #2ac89f)"
                : "linear-gradient(to right, #3891A6, #2db8d4)",
          }}
        >
          {displayPercentage > 15 && (
            <span
              className="text-xs font-bold"
              style={{
                color: displayPercentage > 50 ? "#020202" : "#DDDBF1",
              }}
            >
              {displayPercentage}%
            </span>
          )}
        </div>
      </div>

      {/* Status Message */}
      {solved ? (
        <p className="text-sm font-semibold" style={{ color: "#38D399" }}>
          ✓ Completed!
        </p>
      ) : displayPercentage === 0 ? (
        <p className="text-sm" style={{ color: "#AB9F9D" }}>
          Not started
        </p>
      ) : (
        <p className="text-sm" style={{ color: "#DDDBF1" }}>
          {displayPercentage < 33
            ? "Getting started..."
            : displayPercentage < 66
            ? "Making progress..."
            : "Almost there!"}
        </p>
      )}
    </div>
  );
}

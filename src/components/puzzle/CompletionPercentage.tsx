"use client";

import React, { useState } from "react";
import { ChevronDown, CheckCircle2, Circle } from "lucide-react";

interface PuzzlePart {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  pointsValue: number;
  solved: boolean;
  solvedAt?: string | Date | null;
}

interface CompletionPercentageProps {
  parts: PuzzlePart[];
  overallPercentage: number;
  isMultiPart: boolean;
  puzzleTitle?: string;
}

export default function CompletionPercentage({
  parts,
  overallPercentage,
  isMultiPart,
  puzzleTitle,
}: CompletionPercentageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate percentages
  const solvedParts = parts.filter((p) => p.solved).length;
  const totalParts = parts.length;
  const calculatedPercentage = totalParts > 0
    ? Math.round((solvedParts / totalParts) * 100)
    : overallPercentage;

  // Animation for progress arc
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (calculatedPercentage / 100) * circumference;

  // Get color based on percentage
  const getColorByPercentage = (percentage: number) => {
    if (percentage === 100) return "#38D399"; // Green
    if (percentage >= 75) return "#FDE74C"; // Yellow
    if (percentage >= 50) return "#FA7E59"; // Orange
    return "#AB9F9D"; // Gray
  };

  const progressColor = getColorByPercentage(calculatedPercentage);

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{
        backgroundColor: "rgba(56, 145, 166, 0.08)",
        borderColor: "#3891A6",
      }}
    >
      {/* Main Progress Circle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "#DDDBF1" }}>
            Puzzle Progress
          </h3>
          {isMultiPart && totalParts > 1 && (
            <p style={{ color: "#AB9F9D" }} className="text-xs mt-1">
              {solvedParts} of {totalParts} parts completed
            </p>
          )}
        </div>

        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(171, 159, 157, 0.2)"
              strokeWidth="6"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={progressColor}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute text-center">
            <p style={{ color: progressColor }} className="text-3xl font-bold">
              {calculatedPercentage}%
            </p>
            {calculatedPercentage === 100 && (
              <p style={{ color: "#38D399" }} className="text-xs font-semibold">
                Complete!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Multi-part breakdown */}
      {isMultiPart && totalParts > 1 && (
        <div className="space-y-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 p-2 rounded hover:opacity-80 transition-colors"
            style={{ backgroundColor: "rgba(56, 145, 166, 0.05)" }}
          >
            <ChevronDown
              size={16}
              style={{
                color: "#3891A6",
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
            <span style={{ color: "#3891A6" }} className="text-sm font-medium">
              Part Breakdown
            </span>
          </button>

          {isExpanded && (
            <div className="space-y-2 pl-2">
              {parts.map((part, index) => (
                <div
                  key={part.id}
                  className="p-3 rounded border flex items-start gap-3"
                  style={{
                    backgroundColor: part.solved
                      ? "rgba(56, 211, 153, 0.08)"
                      : "rgba(171, 159, 157, 0.05)",
                    borderColor: part.solved
                      ? "rgba(56, 211, 153, 0.2)"
                      : "rgba(171, 159, 157, 0.2)",
                  }}
                >
                  <div className="flex-shrink-0 pt-1">
                    {part.solved ? (
                      <CheckCircle2
                        size={20}
                        style={{ color: "#38D399" }}
                      />
                    ) : (
                      <Circle
                        size={20}
                        style={{ color: "rgba(171, 159, 157, 0.4)" }}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p
                        style={{
                          color: part.solved ? "#38D399" : "#DDDBF1",
                        }}
                        className="font-semibold text-sm"
                      >
                        Part {index + 1}
                      </p>
                      <p style={{ color: "#AB9F9D" }} className="text-xs">
                        {part.title}
                      </p>
                    </div>

                    {part.description && (
                      <p
                        style={{ color: "#AB9F9D" }}
                        className="text-xs mb-2"
                      >
                        {part.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <p style={{ color: "#AB9F9D" }} className="text-xs">
                        {part.pointsValue} points
                      </p>
                      {part.solved && (
                        <p style={{ color: "#38D399" }} className="text-xs font-semibold">
                          ✓ Solved
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status message */}
      {calculatedPercentage < 100 && (
        <div
          className="p-3 rounded-lg text-xs text-center"
          style={{
            backgroundColor: "rgba(56, 145, 166, 0.05)",
            color: "#3891A6",
          }}
        >
          {calculatedPercentage === 0
            ? "Start solving to see your progress!"
            : `Keep going! You're ${calculatedPercentage}% there.`}
        </div>
      )}

      {calculatedPercentage === 100 && (
        <div
          className="p-3 rounded-lg text-xs text-center font-semibold"
          style={{
            backgroundColor: "rgba(56, 211, 153, 0.1)",
            color: "#38D399",
          }}
        >
          🎉 Puzzle completed! Excellent work!
        </div>
      )}
    </div>
  );
}

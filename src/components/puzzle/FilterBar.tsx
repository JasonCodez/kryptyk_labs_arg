"use client";

import React, { useState } from "react";
import { Search, ChevronDown, X } from "lucide-react";

interface FilterBarProps {
  onSearch: (query: string) => void;
  onDifficultyChange: (difficulty: string) => void;
  onStatusChange: (status: string) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  currentSearch: string;
  currentDifficulty: string;
  currentStatus: string;
  currentSort: { by: string; order: string };
}

export default function FilterBar({
  onSearch,
  onDifficultyChange,
  onStatusChange,
  onSortChange,
  currentSearch,
  currentDifficulty,
  currentStatus,
  currentSort,
}: FilterBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const difficulties = [
    { value: "all", label: "All Difficulties" },
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
    { value: "extreme", label: "Extreme" },
  ];

  const statuses = [
    { value: "all", label: "All Statuses" },
    { value: "unsolved", label: "Unsolved" },
    { value: "in-progress", label: "In Progress" },
    { value: "solved", label: "Solved" },
  ];

  const sortOptions = [
    { value: "order", label: "Release Order" },
    { value: "points", label: "Points (High to Low)" },
    { value: "difficulty", label: "Difficulty" },
    { value: "releaseDate", label: "Release Date" },
  ];

  const hasActiveFilters = currentSearch || currentDifficulty !== "all" || currentStatus !== "all";

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 transform -translate-y-1/2"
          style={{ color: "#3891A6" }}
        />
        <input
          type="text"
          placeholder="Search puzzles by title..."
          value={currentSearch}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border transition-all focus:outline-none"
          style={{
            backgroundColor: "rgba(56, 145, 166, 0.1)",
            borderColor: "#3891A6",
            borderWidth: "1px",
            color: "#DDDBF1",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#FDE74C";
            e.currentTarget.style.backgroundColor = "rgba(56, 145, 166, 0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#3891A6";
            e.currentTarget.style.backgroundColor = "rgba(56, 145, 166, 0.1)";
          }}
        />
        {currentSearch && (
          <button
            onClick={() => onSearch("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-80"
            style={{ color: "#AB9F9D" }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Toggle Advanced Filters */}
      <button
        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
        style={{
          backgroundColor: isAdvancedOpen
            ? "rgba(253, 231, 76, 0.2)"
            : "rgba(56, 145, 166, 0.1)",
          color: isAdvancedOpen ? "#FDE74C" : "#3891A6",
          border: `1px solid ${isAdvancedOpen ? "#FDE74C" : "#3891A6"}`,
        }}
      >
        <span className="text-sm font-medium">
          {isAdvancedOpen ? "Hide" : "Show"} Advanced Filters
        </span>
        <ChevronDown
          size={16}
          style={{
            transform: isAdvancedOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
        {hasActiveFilters && (
          <span
            className="ml-2 px-2 py-0.5 rounded text-xs font-semibold"
            style={{ backgroundColor: "#FA7E59", color: "#020202" }}
          >
            {[currentSearch ? 1 : 0, currentDifficulty !== "all" ? 1 : 0, currentStatus !== "all" ? 1 : 0].reduce((a, b) => a + b, 0)}
          </span>
        )}
      </button>

      {/* Advanced Filters */}
      {isAdvancedOpen && (
        <div
          className="p-4 rounded-lg border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            backgroundColor: "rgba(56, 145, 166, 0.08)",
            borderColor: "#3891A6",
          }}
        >
          {/* Difficulty Filter */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#FDE74C" }}>
              DIFFICULTY
            </label>
            <div className="flex flex-wrap gap-2">
              {difficulties.map((diff) => (
                <button
                  key={diff.value}
                  onClick={() => onDifficultyChange(diff.value)}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor:
                      currentDifficulty === diff.value
                        ? diff.value === "EASY"
                          ? "#10B981"
                          : diff.value === "MEDIUM"
                            ? "#F59E0B"
                            : diff.value === "HARD"
                              ? "#EF4444"
                              : diff.value === "EXPERT"
                                ? "#3891A6"
                                : "#3891A6"
                        : "rgba(171, 159, 157, 0.2)",
                    color: currentDifficulty === diff.value ? "#020202" : "#DDDBF1",
                    boxShadow:
                      currentDifficulty === diff.value
                        ? "0 0 0 2px rgba(253, 231, 76, 0.5)"
                        : "none",
                    transform: currentDifficulty === diff.value ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {diff.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#FDE74C" }}>
              STATUS
            </label>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  onClick={() => onStatusChange(s.value)}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor:
                      currentStatus === s.value
                        ? s.value === "solved"
                          ? "rgba(56, 211, 153, 0.8)"
                          : s.value === "in-progress"
                            ? "rgba(253, 231, 76, 0.8)"
                            : s.value === "unsolved"
                              ? "rgba(250, 126, 89, 0.8)"
                              : "#3891A6"
                        : "rgba(171, 159, 157, 0.2)",
                    color: currentStatus === s.value ? "#020202" : "#DDDBF1",
                    boxShadow:
                      currentStatus === s.value
                        ? "0 0 0 2px rgba(253, 231, 76, 0.5)"
                        : "none",
                    transform: currentStatus === s.value ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#FDE74C" }}>
              SORT BY
            </label>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    // Toggle sort order if same sort is clicked
                    if (currentSort.by === option.value) {
                      onSortChange(option.value, currentSort.order === "asc" ? "desc" : "asc");
                    } else {
                      onSortChange(option.value, "asc");
                    }
                  }}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-all duration-200 flex items-center gap-1"
                  style={{
                    backgroundColor:
                      currentSort.by === option.value
                        ? "#3891A6"
                        : "rgba(171, 159, 157, 0.2)",
                    color:
                      currentSort.by === option.value ? "#020202" : "#DDDBF1",
                    boxShadow:
                      currentSort.by === option.value
                        ? "0 0 0 2px rgba(253, 231, 76, 0.5)"
                        : "none",
                    transform: currentSort.by === option.value ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {option.label}
                  {currentSort.by === option.value && (
                    <span className="text-xs">
                      {currentSort.order === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                onSearch("");
                onDifficultyChange("all");
                onStatusChange("all");
                onSortChange("order", "asc");
              }}
              className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{
                backgroundColor: "rgba(250, 126, 89, 0.2)",
                color: "#FA7E59",
                border: "1px solid #FA7E59",
              }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

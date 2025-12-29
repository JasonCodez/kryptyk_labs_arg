"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Activity } from "@prisma/client";
import {
  CheckCircle,
  AlertCircle,
  Info,
  Lock,
  Zap,
  Eye,
  BarChart3,
  FileText,
  Loader,
} from "lucide-react";

interface ActivityFeedClientProps {
  activities: Activity[];
  total: number;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  security: <Lock className="w-5 h-5" />,
  subscription: <Zap className="w-5 h-5" />,
  view: <Eye className="w-5 h-5" />,
  analytics: <BarChart3 className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  success: "bg-green-500/10 text-green-400 border-green-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  security: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  subscription: "bg-[#3891A6]/10 text-[#3891A6] border-[#3891A6]/20",
  view: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  analytics: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  document: "bg-[#FDE74C]/10 text-[#FDE74C] border-[#FDE74C]/20",
};

export default function ActivityFeedClient({
  activities: initialActivities,
  total,
}: ActivityFeedClientProps) {
  const [activities, setActivities] = useState(initialActivities);
  const [filter, setFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(initialActivities.length < total);

  const filteredActivities = filter
    ? activities.filter((a) => a.type === filter)
    : activities;

  const activityTypes = [...new Set(activities.map((a) => a.type))];

  const loadMore = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        skip: String(skip + 30),
        limit: "30",
        ...(filter && { type: filter }),
      });

      const response = await fetch(`/api/user/activity?${params}`);
      const data = await response.json();

      setActivities((prev) => [...prev, ...data.activities]);
      setSkip((prev) => prev + 30);
      setHasMore(data.activities.length === 30);
    } catch (error) {
      console.error("Failed to load more activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (type: string | null) => {
    setFilter(type);
    setSkip(0);
    // Optionally refetch with filter
  };

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleFilterChange(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === null
              ? "bg-blue-600 text-white"
              : "bg-slate-800 text-gray-400 hover:bg-slate-700"
          }`}
        >
          All Activities
        </button>
        {activityTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleFilterChange(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === type
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-gray-400 hover:bg-slate-700"
            }`}
          >
            {type.replace(/([A-Z])/g, " $1").trim()}
          </button>
        ))}
      </div>

      {/* Activities List */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No activities found</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className={`p-4 rounded-lg border backdrop-blur-sm transition-all hover:bg-opacity-50 ${
                ACTIVITY_COLORS[activity.type] ||
                "bg-slate-800/50 text-gray-400 border-slate-700"
              }`}
            >
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  {ACTIVITY_ICONS[activity.type] || <Info className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{activity.title}</h3>
                      {activity.description && (
                        <p className="text-sm opacity-75 mt-1">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs opacity-60 flex-shrink-0 whitespace-nowrap">
                      {format(new Date(activity.createdAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading && <Loader className="w-4 h-4 animate-spin" />}
          {isLoading ? "Loading..." : "Load More"}
        </button>
      )}

      {/* Summary */}
      <div className="text-center text-sm text-gray-400 pt-4">
        Showing {filteredActivities.length} of {total} activities
      </div>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import AchievementNotification from "@/components/AchievementNotification";

interface Achievement {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  requirement: string;
  conditionType: string;
  conditionValue?: number;
  unlocked: boolean;
  unlockedAt?: Date;
  currentProgress?: number;
  progressPercentage?: number;
}

interface AchievementsData {
  achievements: Achievement[];
  totalUnlocked: number;
  totalAvailable: number;
  rarityCount: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  rarityUnlockedCount: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
}

import { Rarity, rarityColors } from "@/lib/rarity";


export default function AchievementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [notificationAchievement, setNotificationAchievement] = useState<any>(null);
  const [shownAchievements, setShownAchievements] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchAchievements();
      
      // Poll for achievement updates every 5 seconds
      const interval = setInterval(() => {
        fetchAchievements();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [session?.user?.email]);

  const fetchAchievements = async () => {
    try {
      const response = await fetch("/api/user/achievements");
      if (response.ok) {
        const result = await response.json();
        setData(result);

        // Check for newly unlocked achievements (reached 100% progress)
        result.achievements.forEach((achievement: Achievement) => {
          const autoUnlockTypes = ["puzzles_solved", "submission_accuracy", "points_earned", "streak", "custom"];
          const canAutoCollect = autoUnlockTypes.includes(achievement.conditionType || "");
          const isReady = !achievement.unlocked && achievement.progressPercentage === 100 && canAutoCollect;

          // Show modal if achievement just became ready and we haven't shown it yet
          if (isReady && !shownAchievements.has(achievement.id)) {
            setNotificationAchievement(achievement);
            setShownAchievements((prev) => new Set(prev).add(achievement.id));
            
            // Send notification to notification center
            fetch("/api/user/achievements/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                achievementId: achievement.id,
                achievementTitle: achievement.title,
                achievementDescription: achievement.description,
                achievementIcon: achievement.icon,
              }),
            }).catch((err) => console.error("Failed to send notification:", err));
          }
        });
      }
    } catch (error) {
      console.error("Failed to fetch achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const collectAchievement = async (achievementId: string) => {
    setCollecting(achievementId);
    try {
      const response = await fetch("/api/user/achievements/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievementId }),
      });

      if (response.ok) {
        // Refresh achievements after successful collection
        await fetchAchievements();
        // Keep the modal open to show success, then auto-close after 2 seconds
        setTimeout(() => {
          setNotificationAchievement(null);
        }, 2000);
      } else {
        console.error("Failed to collect achievement");
      }
    } catch (error) {
      console.error("Error collecting achievement:", error);
    } finally {
      setCollecting(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#020202" }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!session?.user || !data) {
    return null;
  }

  const categories = ["milestone", "speed", "mastery", "exploration", "collaboration", "special"];
  const filteredAchievements = selectedCategory
    ? data.achievements.filter((a) => a.category === selectedCategory)
    : data.achievements;

  return (
    <main style={{ backgroundColor: "#020202" }} className="min-h-screen">
      {/* Achievement Notification Modal */}
      {notificationAchievement && (
        <AchievementNotification
          achievement={notificationAchievement}
          rarityColors={rarityColors}
          isCollecting={collecting === notificationAchievement.id}
          onClose={() => setNotificationAchievement(null)}
          onCollect={() => collectAchievement(notificationAchievement.id)}
        />
      )}
      {/* Header */}
      <div className="pt-24 pb-16 px-4" style={{ backgroundImage: "linear-gradient(135deg, rgba(56, 145, 166, 0.1) 0%, rgba(253, 231, 76, 0.05) 100%)" }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-4">Achievements</h1>
          <p style={{ color: "#DDDBF1" }}>Unlock badges and earn your place among the puzzle elite</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-4 py-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Progress Card */}
          <div className="border rounded-lg p-8" style={{ backgroundColor: "rgba(56, 145, 166, 0.08)", borderColor: "#3891A6" }}>
            <h3 className="text-2xl font-bold text-white mb-6">Your Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span style={{ color: "#DDDBF1" }}>Overall Completion</span>
                  <span className="text-xl font-bold text-white">
                    {data.totalUnlocked} / {data.totalAvailable}
                  </span>
                </div>
                <div className="w-full bg-black rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      backgroundColor: "#3891A6",
                      width: `${(data.totalUnlocked / data.totalAvailable) * 100}%`,
                    }}
                  />
                </div>
                <p style={{ color: "#AB9F9D" }} className="text-sm mt-2">
                  {Math.round((data.totalUnlocked / data.totalAvailable) * 100)}% Complete
                </p>
              </div>
            </div>
          </div>

          {/* Rarity Breakdown */}
          <div className="border rounded-lg p-8 space-y-3">
            <h3 className="text-2xl font-bold text-white mb-6">Rarity Breakdown</h3>
            {Object.entries(data.rarityCount).map(([rarity, count]) => {
              const rarityKey = rarity as Rarity;
              const colors = rarityColors[rarityKey] || rarityColors["common"];
              const rarityClass = `rarity-text-${rarity}`;
              return (
                <div
                  key={rarity}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border"
                  style={{
                    backgroundColor: `${colors.bg}15`,
                    borderColor: colors.border,
                  }}
                >
                  <span 
                    className={`capitalize font-semibold text-base ${rarityClass}`}
                  >
                    {rarity}
                  </span>
                  <span className="text-lg font-bold text-white">
                    {data?.rarityUnlockedCount?.[rarityKey] || 0}/{count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-white mb-4">Filter by Category</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className="px-6 py-2 rounded-lg font-semibold transition"
              style={{
                backgroundColor: selectedCategory === null ? "#3891A6" : "rgba(56, 145, 166, 0.2)",
                color: "white",
              }}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="px-6 py-2 rounded-lg font-semibold transition capitalize"
                style={{
                  backgroundColor:
                    selectedCategory === category ? "#FDE74C" : "rgba(253, 231, 76, 0.2)",
                  color: selectedCategory === category ? "#020202" : "#FDE74C",
                }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAchievements.map((achievement) => {
            const rarityKey = achievement.rarity as Rarity;
            const color = rarityColors[rarityKey] || rarityColors["common"];
            const autoUnlockTypes = ["puzzles_solved", "submission_accuracy", "points_earned", "streak", "custom"];
            const canAutoCollect = autoUnlockTypes.includes(achievement.conditionType || "");
            const isReadyToCollect = !achievement.unlocked && achievement.progressPercentage === 100 && canAutoCollect;
            return (
              <div
                id={`achievement-${achievement.id}`}
                key={achievement.id}
                className="border rounded-lg p-6 transition transform hover:scale-105"
                style={{
                  backgroundColor: achievement.unlocked ? color.bg : "rgba(0, 0, 0, 0.3)",
                  borderColor: achievement.unlocked ? color.border : isReadyToCollect ? color.border : "#444444",
                  opacity: achievement.unlocked ? 1 : 0.7,
                  borderWidth: isReadyToCollect ? "2px" : "1px",
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-5xl">{achievement.icon}</span>
                  {achievement.unlocked && (
                    <span style={{ color: color.text }} className="text-xs font-bold">
                      ✓ UNLOCKED
                    </span>
                  )}
                  {isReadyToCollect && (
                    <span style={{ color: color.text, backgroundColor: color.bg }} className="text-xs font-bold px-2 py-1 rounded animate-pulse">
                      ⭐ READY!
                    </span>
                  )}
                </div>

                <h4 className="text-lg font-bold text-white mb-2">{achievement.title}</h4>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded capitalize rarity-badge rarity-${achievement.rarity}`} style={{ 
                    /* Inline fallback; CSS will enforce final look */
                    backgroundColor: color.bg,
                    color: color.text,
                    borderWidth: '1px',
                    borderColor: color.border
                  }}>
                    {achievement.rarity}
                  </span>
                </div>
                <p style={{ color: "#DDDBF1" }} className="text-sm mb-4">
                  {achievement.description}
                </p>

                <div className="pt-4 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.1)" }}>
                  <p style={{ color: color.text }} className="text-xs font-semibold mb-2">
                    HOW TO UNLOCK
                  </p>
                  <p style={{ color: "#AB9F9D" }} className="text-xs">
                    {achievement.requirement}
                  </p>
                </div>

                {!achievement.unlocked && achievement.progressPercentage !== undefined && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span style={{ color: "#DDDBF1" }} className="text-xs">
                        Progress
                      </span>
                      <span style={{ color: color.text }} className="text-xs font-semibold">
                        {Math.round(achievement.progressPercentage)}%
                      </span>
                    </div>
                    <div className="w-full bg-black rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          backgroundColor: color.text,
                          width: `${achievement.progressPercentage}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {isReadyToCollect && (
                  <button
                    onClick={() => collectAchievement(achievement.id)}
                    disabled={collecting === achievement.id}
                    className="w-full mt-4 px-4 py-2 rounded-lg font-semibold transition"
                    style={{
                      backgroundColor: color.bg,
                      color: color.text,
                      borderWidth: "1px",
                      borderColor: color.border,
                      opacity: collecting === achievement.id ? 0.6 : 1,
                      cursor: collecting === achievement.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {collecting === achievement.id ? "Collecting..." : "COLLECT"}
                  </button>
                )}

                {achievement.unlocked && achievement.unlockedAt && (
                  <p style={{ color: color.text }} className="text-xs mt-3 italic">
                    Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {filteredAchievements.length === 0 && (
          <div className="text-center py-20">
            <p style={{ color: "#DDDBF1" }} className="text-lg">
              No achievements in this category yet!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

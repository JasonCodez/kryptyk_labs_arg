"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

interface AchievementNotificationProps {
  achievement: {
    id: string;
    icon: string;
    title: string;
    description: string;
    rarity: string;
  };
  rarityColors: Record<string, { bg: string; text: string; border: string }>;
  onClose: () => void;
  onCollect: () => void;
  isCollecting?: boolean;
}

export default function AchievementNotification({
  achievement,
  rarityColors,
  onClose,
  onCollect,
  isCollecting = false,
}: AchievementNotificationProps) {
  const color = rarityColors[achievement.rarity];

  useEffect(() => {
    // Auto-close after 8 seconds
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black opacity-75"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0, opacity: 0, rotate: -10, y: -50 }}
        animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
        exit={{ scale: 0, opacity: 0, rotate: 10, y: 50 }}
        transition={{
          type: "spring",
          stiffness: 150,
          damping: 20,
        }}
        className="relative bg-black border-2 rounded-lg p-8 max-w-md w-full shadow-2xl animate-pulse-slow"
        style={{
          borderColor: color.border,
          backgroundColor: `rgba(0, 0, 0, 0.9)`,
          boxShadow: `0 0 30px ${color.border}40`,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:opacity-70 transition"
        >
          ✕
        </button>

        {/* Content */}
        <div className="text-center">
          {/* Icon with glow */}
          <div className="text-6xl mb-4 inline-block" style={{ filter: `drop-shadow(0 0 10px ${color.text})` }}>
            {achievement.icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            Achievement Unlocked!
          </h2>

          {/* Achievement name and rarity */}
          <div className="mb-4">
            <p className="text-xl font-bold text-white mb-2">
              {achievement.title}
            </p>
            <span
              className="inline-block text-xs font-semibold px-3 py-1 rounded capitalize"
              style={{
                backgroundColor: color.bg,
                color: color.text,
                borderWidth: "1px",
                borderColor: color.border,
              }}
            >
              {achievement.rarity}
            </span>
          </div>

          {/* Description */}
          <p style={{ color: "#DDDBF1" }} className="text-sm mb-6">
            {achievement.description}
          </p>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isCollecting}
              className="flex-1 px-4 py-2 rounded-lg font-semibold transition border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.2)",
                color: "#3891A6",
                borderColor: "#3891A6",
                opacity: isCollecting ? 0.5 : 1,
                cursor: isCollecting ? "not-allowed" : "pointer",
              }}
            >
              Dismiss
            </button>
            <button
              onClick={onCollect}
              disabled={isCollecting}
              className="flex-1 px-4 py-2 rounded-lg font-semibold transition"
              style={{
                backgroundColor: color.bg,
                color: color.text,
                borderWidth: "1px",
                borderColor: color.border,
                opacity: isCollecting ? 0.6 : 1,
                cursor: isCollecting ? "not-allowed" : "pointer",
              }}
            >
              {isCollecting ? "Collecting..." : "Collect Now"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

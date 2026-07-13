"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { juice } from "@/lib/juice";

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

interface ConfettiParticle {
  id: number;
  color: string;
  size: number;
  tx: number;
  ty: number;
  delay: number;
  duration: number;
  isSquare: boolean;
  rotate: number;
}

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

function generateConfetti(color: { text: string; border: string }): ConfettiParticle[] {
  const palette = [color.text, color.border, "#FDE74C", "#ffffff", "#ff6b6b", "#a78bfa", "#34d399", "#fb923c"];
  return Array.from({ length: 70 }, (_, i) => {
    const angle = (i / 70) * 360 + (Math.random() - 0.5) * 25;
    const speed = 90 + Math.random() * 200;
    const rad = (angle * Math.PI) / 180;
    return {
      id: i,
      color: palette[i % palette.length],
      size: 4 + Math.random() * 9,
      tx: Math.cos(rad) * speed,
      ty: Math.sin(rad) * speed - 20,
      delay: Math.random() * 0.25,
      duration: 0.65 + Math.random() * 0.55,
      isSquare: Math.random() > 0.5,
      rotate: Math.random() * 540 - 270,
    };
  });
}

const stagger: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.35 + i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function AchievementNotification({
  achievement,
  rarityColors,
  onClose,
  onCollect,
  isCollecting = false,
}: AchievementNotificationProps) {
  const color = rarityColors[achievement.rarity] ?? { bg: "rgba(200,200,200,0.1)", text: "#fff", border: "#fff" };
  const [particles] = useState<ConfettiParticle[]>(() => generateConfetti(color));
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    juice.reward(); // fanfare lands with the confetti entrance
    setSparkles(
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: 5 + Math.random() * 90,
        y: 10 + Math.random() * 80,
        size: 8 + Math.random() * 10,
        delay: i * 0.22,
      }))
    );
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Confetti burst */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.isSquare ? "2px" : "50%",
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
            animate={{
              x: p.tx,
              y: p.ty,
              opacity: [1, 1, 0],
              scale: [1, 1.4, 0.4],
              rotate: p.rotate,
            }}
            transition={{ duration: p.duration, delay: p.delay, ease: [0.1, 0.7, 0.3, 1] }}
          />
        ))}
      </div>

      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative w-full sm:max-w-md overflow-hidden"
        style={{
          borderRadius: "18px",
          border: `2px solid ${color.border}`,
          backgroundColor: "#050505",
          boxShadow: `0 0 60px ${color.border}55, 0 0 120px ${color.border}20, 0 30px 70px rgba(0,0,0,0.9)`,
        }}
        initial={{ scale: 0.3, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 17, delay: 0.08 } }}
        exit={{ scale: 0.85, opacity: 0, y: -30, transition: { duration: 0.22 } }}
      >
        {/* Gradient shimmer overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "16px",
            background: `linear-gradient(135deg, ${color.border}18 0%, transparent 45%, ${color.border}18 90%)`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating sparkles */}
        {sparkles.map((s) => (
          <motion.span
            key={s.id}
            className="absolute pointer-events-none select-none"
            style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.size, color: color.text, lineHeight: 1 }}
            animate={{ y: [0, -22, 0], opacity: [0, 0.9, 0], scale: [0.5, 1.1, 0.5] }}
            transition={{ duration: 2.2 + (s.id % 3) * 0.5, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
          >
            ✦
          </motion.span>
        ))}

        {/* Banner */}
        <motion.div
          custom={0}
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="relative text-center pt-6 pb-2 px-6"
          style={{ background: `linear-gradient(180deg, ${color.border}28 0%, transparent 100%)` }}
        >
          <p className="text-xs font-black tracking-[0.35em] uppercase" style={{ color: color.text }}>
            ✦ Achievement Unlocked ✦
          </p>
        </motion.div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition z-10 text-lg leading-none"
        >
          ✕
        </button>

        {/* Body */}
        <div className="px-8 pb-8 text-center relative">
          {/* Icon + pulsing rings */}
          <div className="relative inline-flex items-center justify-center mb-5 mt-2">
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                className="absolute rounded-full"
                style={{ border: `1px solid ${color.border}55` }}
                animate={{ width: [56, 56 + ring * 38], height: [56, 56 + ring * 38], opacity: [0.7, 0] }}
                transition={{ duration: 1.9, delay: ring * 0.32, repeat: Infinity, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="relative z-10 leading-none"
              style={{
                fontSize: "5rem",
                filter: `drop-shadow(0 0 18px ${color.text}) drop-shadow(0 0 40px ${color.border}80)`,
              }}
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0, transition: { type: "spring", stiffness: 240, damping: 13, delay: 0.28 } }}
            >
              {achievement.icon}
            </motion.div>
          </div>

          {/* Title */}
          <motion.h2
            custom={1}
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="text-3xl font-black text-white mb-2 leading-tight"
          >
            {achievement.title}
          </motion.h2>

          {/* Rarity badge */}
          <motion.div custom={2} variants={stagger} initial="hidden" animate="visible" className="mb-4">
            <span
              className="inline-block text-xs font-black px-4 py-1.5 rounded-full capitalize tracking-widest"
              style={{
                backgroundColor: color.bg,
                color: color.text,
                border: `1px solid ${color.border}`,
                boxShadow: `0 0 14px ${color.border}55`,
              }}
            >
              {achievement.rarity}
            </span>
          </motion.div>

          {/* Description */}
          <motion.p
            custom={3}
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="text-sm mb-7 leading-relaxed"
            style={{ color: "#DDDBF1" }}
          >
            {achievement.description}
          </motion.p>

          {/* Buttons */}
          <motion.div custom={4} variants={stagger} initial="hidden" animate="visible" className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isCollecting}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm border transition-colors"
              style={{ backgroundColor: "transparent", color: "#d1d5db", borderColor: "rgba(255,255,255,0.18)" }}
            >
              Dismiss
            </button>

            {/* Collect button with shimmer + glow pulse */}
            <motion.button
              onClick={onCollect}
              disabled={isCollecting}
              className="flex-1 px-4 py-2.5 rounded-lg font-black text-sm relative overflow-hidden"
              style={{
                backgroundColor: color.border,
                color: "#000",
                cursor: isCollecting ? "not-allowed" : "pointer",
                opacity: isCollecting ? 0.6 : 1,
              }}
              animate={
                isCollecting
                  ? {}
                  : { boxShadow: [`0 0 14px ${color.border}50`, `0 0 28px ${color.border}90`, `0 0 14px ${color.border}50`] }
              }
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Shimmer sweep */}
              {!isCollecting && (
                <motion.div
                  className="absolute inset-y-0 w-1/3 pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                    skewX: "-15deg",
                  }}
                  initial={{ left: "-40%" }}
                  animate={{ left: "150%" }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
                />
              )}
              <span className="relative z-10">
                {isCollecting ? "⏳ Collecting..." : "🎉 Collect!"}
              </span>
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}


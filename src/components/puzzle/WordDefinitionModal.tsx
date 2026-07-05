"use client";

import { useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export interface WordDefinitionData {
  phonetic: string | null;
  audioUrl: string | null;
  partOfSpeech: string | null;
  definition: string;
  example: string | null;
}

export interface WordDefinitionModalProps {
  word: string;
  color: { bg: string; border: string; text: string };
  status: "loading" | "found" | "not-found";
  data?: WordDefinitionData;
  onDismiss: () => void;
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className="h-3 rounded-full animate-pulse"
      style={{ width, background: "rgba(255,255,255,0.08)" }}
    />
  );
}

// Spells the found word out as grid-style letter tiles — the same visual language as the
// puzzle board itself — instead of plain text, so the modal reads as a direct continuation
// of the find rather than a generic dialog bolted on top of it.
function LetterTiles({ word, color }: { word: string; color: { bg: string; border: string; text: string } }) {
  const letters = word.toUpperCase().split("");
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap px-2">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: -14, scale: 0.6, rotate: -6 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{ delay: 0.12 + i * 0.045, type: "spring", stiffness: 380, damping: 16 }}
          className="flex items-center justify-center font-black rounded-lg"
          style={{
            width: "2.15rem",
            height: "2.15rem",
            fontSize: "1.05rem",
            background: color.bg,
            border: `2px solid ${color.border}`,
            color: color.text,
            boxShadow: `0 3px 10px ${color.border}45, inset 0 1px 0 rgba(255,255,255,0.12)`,
          }}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
};

export default function WordDefinitionModal({ word, color, status, data, onDismiss }: WordDefinitionModalProps) {
  useBodyScrollLock();

  const playPronunciation = useCallback(() => {
    if (!data?.audioUrl) return;
    try {
      const clip = new Audio(data.audioUrl);
      clip.volume = 0.7;
      void clip.play().catch(() => {});
    } catch {}
  }, [data?.audioUrl]);

  return (
    <AnimatePresence>
      <motion.div
        key="word-def-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        onClick={onDismiss}
      >
        <motion.div
          key="word-def-card"
          initial={{ scale: 0.85, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="relative w-full max-w-sm rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(160deg, rgba(15,15,26,0.98) 0%, rgba(4,4,8,0.98) 100%)",
            border: `2px solid ${color.border}66`,
            boxShadow: `0 0 48px ${color.border}26, 0 16px 64px rgba(0,0,0,0.8)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient glow, tinted to this word's grid color */}
          <div
            aria-hidden
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: color.border, opacity: 0.2, filter: "blur(56px)" }}
          />
          {/* Faint dot-grid texture, echoing the puzzle board */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
              maskImage: "linear-gradient(to bottom, black, transparent 85%)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent 85%)",
            }}
          />

          {/* Top shimmer */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${color.border}, transparent)` }}
          />

          <button
            onClick={onDismiss}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none"
          >
            ✕
          </button>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="relative p-7 pt-8 text-center"
          >
            <motion.div
              variants={item}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-5"
              style={{ background: color.bg, border: `1px solid ${color.border}80`, color: color.text }}
            >
              ✓ Word Found
            </motion.div>

            <div className="mb-5">
              <LetterTiles word={word} color={color} />
            </div>

            {status === "loading" && (
              <motion.div variants={item} className="flex flex-col items-center gap-3 mt-2 mb-2">
                <SkeletonLine width="40%" />
                <div className="w-full flex flex-col items-center gap-2 mt-2">
                  <SkeletonLine width="90%" />
                  <SkeletonLine width="75%" />
                </div>
              </motion.div>
            )}

            {status === "not-found" && (
              <motion.p variants={item} className="text-sm leading-relaxed mt-3" style={{ color: "#9CA3AF" }}>
                📖 No dictionary entry for this one — but great find all the same!
              </motion.p>
            )}

            {status === "found" && data && (
              <>
                {data.audioUrl && (
                  // Raw IPA transcription (e.g. "/ˈæs.ɪd/") is unfamiliar notation to anyone
                  // who doesn't read phonetic alphabet — symbols like "ɪ" are deliberately
                  // shaped like a small capital I, so it just reads as a typo to most players
                  // no matter the font. The audio button is unambiguous, so that's the only
                  // pronunciation aid shown.
                  <motion.button
                    variants={item}
                    onClick={playPronunciation}
                    className="flex items-center gap-1.5 mx-auto mb-4 px-3 py-1 rounded-full text-xs font-semibold transition-transform hover:scale-105 active:scale-95"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#e2e8f0" }}
                  >
                    🔊 Hear it
                  </motion.button>
                )}

                {data.partOfSpeech && (
                  <motion.div variants={item} className="flex flex-col items-center mb-4">
                    <span
                      className="text-xs italic tracking-wide"
                      style={{ color: color.text, opacity: 0.9 }}
                    >
                      {data.partOfSpeech}
                    </span>
                    <span className="w-8 h-px mt-2" style={{ background: `${color.border}55` }} />
                  </motion.div>
                )}

                <motion.p variants={item} className="text-sm leading-relaxed text-left" style={{ color: "#e2e8f0" }}>
                  {data.definition}
                </motion.p>

                {data.example && (
                  <motion.div
                    variants={item}
                    className="mt-4 pl-3 text-left"
                    style={{ borderLeft: `2px solid ${color.border}55` }}
                  >
                    <p className="text-xs leading-relaxed italic" style={{ color: "#7c8aa3" }}>
                      {data.example}
                    </p>
                  </motion.div>
                )}
              </>
            )}

            <motion.button
              variants={item}
              onClick={onDismiss}
              disabled={status === "loading"}
              className="w-full mt-6 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg, ${color.bg}, ${color.border}30)`,
                border: `1px solid ${color.border}80`,
                color: color.text,
              }}
            >
              Keep Searching →
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

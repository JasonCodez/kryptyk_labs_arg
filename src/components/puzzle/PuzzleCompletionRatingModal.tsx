"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { RatingInput } from "./RatingInput";
import { useRegisterModal } from "@/hooks/useRegisterModal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface PuzzleCompletionRatingModalProps {
  puzzleId: string;
  puzzleTitle: string;
  difficulty?: string;
  onClose: () => void;
  onSubmit?: () => void;
  initialAwardedPoints?: number | null;
  completionSeconds?: number | null;
  funFact?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function buildShareText(puzzleTitle: string, puzzleId: string, completionSeconds: number | null, difficulty?: string): string {
  const url = `https://puzzlewarz.com/puzzles/${puzzleId}`;
  const lines = [`🧩 I just cracked "${puzzleTitle}" on Puzzle Warz!`];
  if (typeof completionSeconds === "number") lines.push(`⏱️ Time: ${formatTime(completionSeconds)}`);
  if (difficulty) lines.push(`🔥 Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`);
  lines.push(`Think you can beat it? → ${url}`);
  return lines.join("\n");
}

export default function PuzzleCompletionRatingModal({
  puzzleId,
  puzzleTitle,
  difficulty,
  onClose,
  onSubmit,
  initialAwardedPoints = null,
  completionSeconds = null,
  funFact,
}: PuzzleCompletionRatingModalProps) {
  useRegisterModal('puzzle-rating-modal');
  useBodyScrollLock();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState<number | null>(initialAwardedPoints ?? null);
  const [copied, setCopied] = useState(false);

  const handleRatingSubmitted = () => {
    setIsSubmitted(true);
  };

  const handleCopy = async () => {
    const text = buildShareText(puzzleTitle, puzzleId, completionSeconds, difficulty);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTwitterShare = () => {
    const text = buildShareText(puzzleTitle, puzzleId, completionSeconds, difficulty);
    const url = `https://puzzlewarz.com/puzzles/${puzzleId}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text + '\n' + url)}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const handleFacebookShare = () => {
    const url = `https://puzzlewarz.com/puzzles/${puzzleId}`;
    const text = buildShareText(puzzleTitle, puzzleId, completionSeconds, difficulty);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const handleWhatsAppShare = () => {
    const text = buildShareText(puzzleTitle, puzzleId, completionSeconds, difficulty);
    const url = `https://puzzlewarz.com/puzzles/${puzzleId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, "_blank", "noopener,noreferrer");
  };

  const handleRedditShare = () => {
    const text = buildShareText(puzzleTitle, puzzleId, completionSeconds, difficulty);
    const url = `https://puzzlewarz.com/puzzles/${puzzleId}`;
    window.open(`https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const handleTelegramShare = () => {
    const text = buildShareText(puzzleTitle, puzzleId, completionSeconds, difficulty);
    const url = `https://puzzlewarz.com/puzzles/${puzzleId}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  return (
    <>
      {/* Modal Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="flex min-h-[100dvh] items-center justify-center px-4 py-4">
          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border bg-gray-900 p-5 shadow-2xl sm:max-w-md sm:p-8"
            style={{
              backgroundColor: "rgba(2, 2, 2, 0.95)",
              borderColor: "#FDE74C",
              borderWidth: "2px",
              fontFamily: "var(--font-geist-sans, sans-serif)",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Great Job! 🎉</h2>
              <p
                className="text-sm mt-1"
                style={{ color: "#DDDBF1" }}
              >
                You solved the puzzle
              </p>
              {typeof completionSeconds === 'number' ? (
                <div className="text-sm mt-2" style={{ color: '#AB9F9D' }}>
                  Completed in <span style={{ color: '#FDE74C', fontWeight: 700 }}>{Math.floor(completionSeconds/60).toString().padStart(2,'0')}:{(completionSeconds%60).toString().padStart(2,'0')}</span>
                </div>
              ) : null}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl leading-none">✕</button>
          </div>

          {/* Success Message */}
          { (initialAwardedPoints || awardedPoints) && !isSubmitted && (
            <div
              className="mb-4 p-3 rounded-lg border text-center"
              style={{ backgroundColor: 'rgba(253,231,76,0.06)', borderColor: '#FDE74C' }}
            >
              <div style={{ color: '#FDE74C', fontWeight: 700 }}>{`+${initialAwardedPoints ?? awardedPoints} points awarded`}</div>
            </div>
          )}

          {/* Fun Fact */}
          {funFact && (
            <div
              className="mb-4 p-4 rounded-lg border"
              style={{ backgroundColor: 'rgba(56,145,166,0.08)', borderColor: 'rgba(56,145,166,0.35)' }}
            >
              <div style={{ color: '#9BD1D6', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>💡 Fun Fact</div>
              <p style={{ color: '#DDDBF1', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{funFact}</p>
            </div>
          )}

          {isSubmitted && (
            <div
              className="mb-6 p-4 rounded-lg border text-white text-center"
              style={{
                backgroundColor: "rgba(56, 189, 248, 0.2)",
                borderColor: "#38B9F8",
              }}
            >
              ✓ Thanks for your rating!
              {awardedPoints ? (
                <div style={{ marginTop: 6, color: '#FDE74C', fontWeight: 700 }}>+{awardedPoints} points awarded</div>
              ) : null}
            </div>
          )}

          {/* Rating Input Component */}
          {!isSubmitted && (
            <div>
              {/* Bonus incentive */}
              <div
                className="mb-4 flex items-center justify-center gap-2 p-3 rounded-xl"
                style={{ background: 'rgba(253,231,76,0.08)', border: '1px solid rgba(253,231,76,0.25)' }}
              >
                <span style={{ fontSize: 18 }}>🌟</span>
                <p className="text-sm font-semibold" style={{ color: '#FDE74C' }}>
                  Leave a rating and earn <strong>+10 bonus points!</strong>
                </p>
              </div>
              <p
                className="text-center mb-4 text-sm"
                style={{ color: "#DDDBF1" }}
              >
                How would you rate this puzzle?
              </p>
              <RatingInput
                puzzleId={puzzleId}
                onSubmit={async (rating, review, pointsAwarded) => {
                  if (typeof pointsAwarded === 'number' && pointsAwarded > 0) {
                    setAwardedPoints(pointsAwarded);
                  }
                  handleRatingSubmitted();
                }}
              />
            </div>
          )}

          {/* Share section — always visible */}
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs text-center mb-3" style={{ color: "#6b7280" }}>Challenge your friends</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              {/* X / Twitter */}
              <button
                onClick={handleTwitterShare}
                title="Share on X / Twitter"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#e5e7eb", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631zM17.083 20.248h1.833L7.084 4.126H5.117z"/></svg>
                X
              </button>
              {/* Facebook */}
              <button
                onClick={handleFacebookShare}
                title="Share on Facebook"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(24,119,242,0.4)", background: "rgba(24,119,242,0.1)", color: "#5b9cf6", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                Facebook
              </button>
              {/* WhatsApp */}
              <button
                onClick={handleWhatsAppShare}
                title="Share on WhatsApp"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(37,211,102,0.4)", background: "rgba(37,211,102,0.1)", color: "#4ade80", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </button>
              {/* Reddit */}
              <button
                onClick={handleRedditShare}
                title="Share on Reddit"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,69,0,0.4)", background: "rgba(255,69,0,0.1)", color: "#f97316", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                Reddit
              </button>
              {/* Telegram */}
              <button
                onClick={handleTelegramShare}
                title="Share on Telegram"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(0,136,204,0.4)", background: "rgba(0,136,204,0.1)", color: "#38bdf8", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </button>
              {/* Copy */}
              <button
                onClick={handleCopy}
                title="Copy to clipboard"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: copied ? "1px solid rgba(56,211,153,0.5)" : "1px solid rgba(255,255,255,0.15)", background: copied ? "rgba(56,211,153,0.12)" : "rgba(255,255,255,0.04)", color: copied ? "#38D399" : "#9ca3af", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>
          </div>

          {/* Close Button */}
          {isSubmitted && (
            <button
              onClick={() => { onClose(); onSubmit?.(); }}
              className="w-full mt-4 px-4 py-2 rounded-lg font-semibold transition-colors"
              style={{
                backgroundColor: "#FDE74C",
                color: "#020202",
              }}
            >
              Continue
            </button>
          )}
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterModal } from "@/hooks/useRegisterModal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import GameButton from "@/components/game-ui/GameButton";

interface ForumRulesModalProps {
  open: boolean;
  accepting?: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const RULES: { title: string; body: string }[] = [
  { title: "Be respectful", body: "No harassment, hate speech, personal attacks, or targeted abuse toward other members. Disagree with ideas, not people." },
  { title: "Stay on topic", body: "Keep discussions related to puzzles, strategy, feedback, and the PuzzleWarz community. Off-topic posts may be moved or removed." },
  { title: "No spam or self-promotion", body: "Don't repeatedly post the same content, advertise unrelated products or services, or use the forum to drive traffic elsewhere." },
  { title: "No links", body: "Links aren't allowed in posts or comments and will be automatically rejected — describe what you mean instead of linking out." },
  { title: "No cheating or exploits", body: "Don't share exploits, cheats, or ways to circumvent puzzle mechanics, scoring, or leaderboards." },
  { title: "You own what you post", body: "By posting, you confirm the content is yours to share and grant PuzzleWarz a license to display it. Don't post anything you don't have the rights to." },
  { title: "Moderation", body: "PuzzleWarz may remove content, close threads, or restrict posting privileges at its discretion for violations of these rules." },
  { title: "Keep it sustainable", body: "To keep the forum healthy for everyone, posting is limited to 10 new posts and 30 comments per hour." },
];

export default function ForumRulesModal({ open, accepting = false, onAccept, onClose }: ForumRulesModalProps) {
  useRegisterModal("forum-rules-modal", open);
  useBodyScrollLock(open);

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setScrolledToBottom(false); return; }
    // If the rules already fit on screen without a scrollbar, don't leave the user
    // stuck trying to perform a scroll gesture that can't happen.
    const el = contentRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setScrolledToBottom(true);
  }, [open]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setScrolledToBottom(true);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-y-auto"
          style={{ backgroundColor: "rgba(23,11,38,0.78)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
            <motion.div
              className="relative w-full mx-4 rounded-3xl overflow-hidden flex flex-col"
              style={{
                maxWidth: 560,
                maxHeight: "min(720px, 88vh)",
                background: "linear-gradient(160deg, #32205A 0%, #241640 60%, #170B26 100%)",
                border: "1px solid rgba(255,201,60,0.3)",
                boxShadow: "0 0 80px rgba(255,201,60,0.12), 0 32px 80px rgba(0,0,0,0.7)",
              }}
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
            >
              {/* Top glow bar */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: "linear-gradient(90deg, transparent, #FFC93C, transparent)" }}
              />

              {/* Header */}
              <div className="px-7 pt-7 pb-4" style={{ borderBottom: "1px solid rgba(255,79,163,0.15)" }}>
                <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#FFC93C" }}>
                  Before you post
                </p>
                <h2 className="text-2xl font-black text-white" style={{ letterSpacing: "-0.02em" }}>
                  Forum Rules
                </h2>
                <p className="text-sm mt-2" style={{ color: "#C8B8E0" }}>
                  Please read through — you'll be able to accept once you've reached the bottom.
                </p>
              </div>

              {/* Scrollable rules content */}
              <div ref={contentRef} onScroll={handleScroll} className="overflow-y-auto px-7 py-5" style={{ flex: 1 }}>
                <ol className="flex flex-col gap-4" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {RULES.map((rule, i) => (
                    <li key={rule.title} className="flex gap-3">
                      <span
                        className="flex items-center justify-center shrink-0 rounded-full text-xs font-bold"
                        style={{ width: 24, height: 24, background: "rgba(255,201,60,0.12)", color: "#FFC93C", border: "1px solid rgba(255,201,60,0.3)" }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-white mb-1">{rule.title}</p>
                        <p className="text-sm leading-relaxed" style={{ color: "#C8B8E0" }}>{rule.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-xs mt-6 pt-5" style={{ color: "#8C7BAD", borderTop: "1px solid rgba(255,79,163,0.15)" }}>
                  Violating these rules may result in content removal, posting restrictions, or account suspension.
                </p>
              </div>

              {/* Footer actions */}
              <div
                className="px-7 py-5 flex items-center gap-3"
                style={{ borderTop: "1px solid rgba(255,79,163,0.15)", background: "rgba(255,255,255,0.015)" }}
              >
                <button
                  onClick={onClose}
                  disabled={accepting}
                  className="text-sm font-semibold"
                  style={{ color: "#C8B8E0", background: "none", border: "none", cursor: accepting ? "default" : "pointer" }}
                >
                  Cancel
                </button>
                <div style={{ flex: 1 }} />
                <GameButton
                  onClick={onAccept}
                  disabled={!scrolledToBottom || accepting}
                  variant="gold"
                  size="sm"
                >
                  {accepting ? "Saving…" : scrolledToBottom ? "I Agree — Continue" : "Scroll to the bottom to continue"}
                </GameButton>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

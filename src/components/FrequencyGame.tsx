"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  buildFrequencyCanonicalConfig,
  canonicalizeFrequencyAnswer,
  isWithinFrequencyWordLimit,
  MAX_FREQUENCY_ANSWER_WORDS,
  MAX_FREQUENCY_ANSWERS,
} from "@/lib/frequency";

interface FrequencyAnswer {
  id: string;
  displayText: string;
  text: string;
  count: number;
}

interface Question {
  id: string;
  question: string;
  status: string;
  scheduledFor: string;
  canonicalGroups?: unknown;
}

interface FrequencyGameProps {
  /** Pre-fetched question. If null, shows "no puzzle today" state. */
  question: Question | null;
  /** Whether the current user already submitted */
  alreadySubmitted?: boolean;
  /** Existing submission (if alreadySubmitted=true) */
  existingSubmission?: { answers: string[]; score: number } | null;
  /** Pre-fetched results (if revealed or already submitted) */
  initialResults?: { answers: FrequencyAnswer[]; totalSubmissions: number } | null;
  /** Session ID for guest tracking */
  sessionId?: string | null;
  /** True when the user is not authenticated */
  isGuest?: boolean;
}

const TEAL = "#3891A6";
const EMPTY_INPUTS = Array.from({ length: MAX_FREQUENCY_ANSWERS }, () => "");

export default function FrequencyGame({
  question,
  alreadySubmitted = false,
  existingSubmission = null,
  initialResults = null,
  sessionId,
  isGuest = false,
}: FrequencyGameProps) {
  const [phase, setPhase] = useState<"input" | "submitted" | "reveal">(
    alreadySubmitted ? (initialResults ? "reveal" : "submitted") : "input"
  );
  const [inputs, setInputs] = useState<string[]>(
    alreadySubmitted && existingSubmission
      ? existingSubmission.answers.slice(0, MAX_FREQUENCY_ANSWERS)
      : EMPTY_INPUTS
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ answers: FrequencyAnswer[]; totalSubmissions: number } | null>(
    initialResults ?? null
  );
  const [score, setScore] = useState<number>(existingSubmission?.score ?? 0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [freqCopied, setFreqCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Launch notification CTA ─────────────────────────────────────────────
  const [showLaunchCta, setShowLaunchCta] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const justSubmitted = useRef(false);
  const canonicalConfig = buildFrequencyCanonicalConfig(question?.canonicalGroups ?? null);

  // Show the CTA a moment after a fresh submission (not on page reload)
  useEffect(() => {
    if (!justSubmitted.current) return;
    if (phase !== "submitted" && phase !== "reveal") return;
    try { if (localStorage.getItem("pw_launch_notify_done")) return; } catch { /* ignore */ }
    const delay = phase === "reveal" ? 2000 : 700;
    const timer = setTimeout(() => {
      setShowLaunchCta(true);
      justSubmitted.current = false;
    }, delay);
    return () => clearTimeout(timer);
  }, [phase]);

  const handleDismissLaunchCta = () => {
    setShowLaunchCta(false);
    try { localStorage.setItem("pw_launch_notify_done", "1"); } catch { /* ignore */ }
  };

  const handleNotifySubmit = useCallback(async () => {
    if (!notifyEmail.trim() || notifySubmitting) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail.trim())) {
      setNotifyError("Please enter a valid email.");
      return;
    }
    setNotifySubmitting(true);
    setNotifyError(null);
    try {
      const resp = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: notifyEmail.trim(), sessionId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setNotifyError(data.error ?? "Something went wrong.");
      } else {
        setNotifyDone(true);
        try { localStorage.setItem("pw_launch_notify_done", "1"); } catch { /* ignore */ }
        setTimeout(() => setShowLaunchCta(false), 3000);
      }
    } catch {
      setNotifyError("Network error. Please try again.");
    } finally {
      setNotifySubmitting(false);
    }
  }, [notifyEmail, notifySubmitting, sessionId]);

  // Auto-reveal bars one by one after results arrive
  useEffect(() => {
    if (phase !== "reveal" || !results) return;
    setRevealedCount(0);
    const total = results.answers.length;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setRevealedCount(i);
      if (i >= total) clearInterval(timer);
    }, 120);
    return () => clearInterval(timer);
  }, [phase, results]);

  const handleInputChange = (idx: number, value: string) => {
    if (phase !== "input") return;
    setInputs((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const next = idx + 1;
      if (next < MAX_FREQUENCY_ANSWERS) {
        setActiveIndex(next);
        inputRefs.current[next]?.focus();
      }
    }
  };

  const filledAnswers = inputs.filter((a) => a.trim().length > 0);
  const tooLongAnswer = filledAnswers.find((a) => !isWithinFrequencyWordLimit(a));

  const handleSubmit = useCallback(async () => {
    if (submitting || !question || filledAnswers.length === 0) return;
    if (tooLongAnswer) {
      setError(`Answers can be at most ${MAX_FREQUENCY_ANSWER_WORDS} words: "${tooLongAnswer}"`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/frequency/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          answers: filledAnswers,
          sessionId,
        }),
        credentials: "same-origin",
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setScore(data.score ?? 0);
      justSubmitted.current = true;
      if (data.results) {
        setResults(data.results);
        setPhase("reveal");
      } else {
        setPhase("submitted");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, question, filledAnswers, tooLongAnswer, sessionId]);

  // Compute max count for bar scaling
  const maxCount = results ? Math.max(...results.answers.map((a) => a.count), 1) : 1;

  // Which of the user's submitted answers matched a result bar
  const userNormalized = new Set(
    filledAnswers
      .map((answer) => canonicalizeFrequencyAnswer(answer, canonicalConfig))
      .filter(Boolean)
  );

  function getShareText() {
    if (!results) return "";
    const lines = results.answers.slice(0, 6).map((a) => {
      const pct = Math.round((a.count / results.totalSubmissions) * 100);
      const bars = "█".repeat(Math.round(pct / 10)).padEnd(10, "░");
      const mine = userNormalized.has(a.text) ? " ✓" : "";
      return `${bars} ${a.displayText}${mine}`;
    });
    return `FREQUENCY #${question?.id.slice(-4).toUpperCase() ?? "?"}  🎯 ${score}pts\n"${question?.question}"\n\n${lines.join("\n")}\n\npuzzlewarz.com`;
  }

  // ── No question today ────────────────────────────────────────────────────
  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-4xl mb-4">📡</p>
        <p className="text-lg font-semibold text-white">No question scheduled for today.</p>
        <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>Check back tomorrow!</p>
      </div>
    );
  }

  // ── Launch notification CTA modal (shared across submitted + reveal phases) ──
  const launchCtaModal = (
    <AnimatePresence>
      {showLaunchCta && (
        <motion.div
          key="launch-cta-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(2,2,2,0.88)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleDismissLaunchCta(); }}
        >
          <motion.div
            key="launch-cta-card"
            initial={{ scale: 0.88, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="relative w-full max-w-sm rounded-2xl"
            style={{ background: "#0c1520", border: "1px solid rgba(56,145,166,0.45)", boxShadow: "0 0 48px rgba(56,145,166,0.15), 0 24px 80px rgba(0,0,0,0.8)" }}
          >
            {/* Top shimmer */}
            <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl" style={{ background: "linear-gradient(90deg, transparent, rgba(56,145,166,0.8), transparent)" }} />

            {/* Close button */}
            <button
              onClick={handleDismissLaunchCta}
              className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", color: "#64748b", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
              aria-label="Dismiss"
            >
              ×
            </button>

            <div className="p-6">
              {notifyDone ? (
                <div className="text-center py-4">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-lg font-bold text-white">You&apos;re on the list!</p>
                  <p className="text-sm mt-1.5" style={{ color: "#94a3b8" }}>
                    {isGuest && score > 0
                      ? `Your ${score} pts are banked and will be credited to your account on launch day.`
                      : "We'll ping you the moment Puzzle Warz officially launches."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-5">
                    <p className="text-3xl mb-2">🔔</p>
                    <p className="text-lg font-bold text-white leading-snug">
                      {isGuest ? "Save your points & get notified" : "Get notified on launch day"}
                    </p>
                    <p className="text-sm mt-2" style={{ color: "#94a3b8" }}>
                      {isGuest
                        ? score > 0
                          ? <span>We&apos;ll bank your <span style={{ color: TEAL, fontWeight: 700 }}>{score} pts</span> and credit them to your account when you sign up on launch day.</span>
                          : "Your answers are saved. Points will be credited to your account when you sign up on launch day."
                        : "Enter your email and we'll ping you the moment Puzzle Warz officially launches."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => { setNotifyEmail(e.target.value); setNotifyError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleNotifySubmit(); }}
                      placeholder="your@email.com"
                      autoComplete="email"
                      className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                      style={{
                        background: "rgba(56,145,166,0.1)",
                        border: `1px solid ${notifyError ? "rgba(239,68,68,0.6)" : "rgba(56,145,166,0.35)"}`,
                      }}
                    />
                    {notifyError && <p className="text-xs text-red-400">{notifyError}</p>}
                    <button
                      onClick={handleNotifySubmit}
                      disabled={notifySubmitting || !notifyEmail.trim()}
                      className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100"
                      style={{ background: TEAL }}
                    >
                      {notifySubmitting ? "Saving…" : "Notify Me on Launch Day →"}
                    </button>
                    <button
                      onClick={handleDismissLaunchCta}
                      className="text-xs text-center py-1"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}
                    >
                      Maybe later
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Submitted but not yet revealed ──────────────────────────────────────
  if (phase === "submitted") {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <p className="text-5xl">📡</p>
          </motion.div>
          <p className="text-xl font-bold text-white">Answers locked in!</p>
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            Results will be revealed once the question closes. Come back later to see how the crowd thinks!
          </p>
          <div className="mt-4 rounded-xl p-4 border w-full max-w-sm" style={{ background: "rgba(56,145,166,0.08)", borderColor: "rgba(56,145,166,0.3)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: TEAL }}>YOUR ANSWERS</p>
            {filledAnswers.map((a, i) => (
              <p key={i} className="text-sm text-white py-0.5">{i + 1}. {a}</p>
            ))}
          </div>
          {isGuest && (
            <div className="rounded-xl p-4 border w-full max-w-sm text-center" style={{ background: "rgba(234,179,8,0.08)", borderColor: "rgba(234,179,8,0.25)" }}>
              <p className="text-sm font-semibold text-white mb-1">💾 Your score isn&apos;t saved</p>
              <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>Create a free account to track your daily streak, save points, and appear on the leaderboard.</p>
              <a href="/auth/register" className="inline-block rounded-lg px-4 py-2 text-sm font-bold" style={{ background: "rgba(234,179,8,0.2)", border: "1px solid rgba(234,179,8,0.4)", color: "#fde68a" }}>
                Create Account — It&apos;s Free →
              </a>
            </div>
          )}
        </div>
        {launchCtaModal}
      </>
    );
  }

  // ── Results reveal ────────────────────────────────────────────────────────
  if (phase === "reveal" && results) {
    const maxScore = 500;
    const pct = Math.min(Math.round((score / maxScore) * 100), 100);

    return (
      <>
        <div className="flex flex-col gap-5 w-full max-w-lg mx-auto">
          {/* Score card */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 text-center border"
            style={{ background: "rgba(56,145,166,0.1)", borderColor: "rgba(56,145,166,0.4)" }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: TEAL }}>YOUR SCORE</p>
            <p className="text-5xl font-black text-white">{score}</p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>out of ~{maxScore} · {pct}% crowd match</p>
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: TEAL }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </motion.div>

        {/* Bar chart */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wider" style={{ color: "#64748b" }}>
            {results.totalSubmissions.toLocaleString()} PLAYER{results.totalSubmissions !== 1 ? "S" : ""} ANSWERED
          </p>
          {results.answers.map((answer, i) => {
            const pctBar = Math.round((answer.count / results.totalSubmissions) * 100);
            const widthPct = Math.round((answer.count / maxCount) * 100);
            const isMine = userNormalized.has(answer.text);
            const visible = i < revealedCount;

            return (
              <AnimatePresence key={answer.id}>
                {visible && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-3"
                  >
                    {/* Bar */}
                    <div className="flex-1 relative h-9 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-lg"
                        style={{
                          background: isMine
                            ? `linear-gradient(90deg, ${TEAL}, rgba(56,145,166,0.6))`
                            : "rgba(255,255,255,0.12)",
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.5, delay: 0.05 }}
                      />
                      <div className="absolute inset-0 flex items-center px-3 justify-between">
                        <span className="text-sm font-semibold text-white truncate">
                          {isMine && <span className="mr-1">✓</span>}
                          {answer.displayText}
                        </span>
                        <span className="text-xs font-bold ml-2 shrink-0" style={{ color: isMine ? "#fff" : "#94a3b8" }}>
                          {pctBar}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>

        {/* Share */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8, textAlign: "center" }}>Share Your Result</p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(getShareText())}`, "_blank", "noopener,noreferrer,width=600,height=500")}
              title="Share on X / Twitter"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#e5e7eb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631zM17.083 20.248h1.833L7.084 4.126H5.117z"/></svg>
              X
            </button>
            <button
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://puzzlewarz.com")}&quote=${encodeURIComponent(getShareText())}`, "_blank", "noopener,noreferrer,width=600,height=500")}
              title="Share on Facebook"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(24,119,242,0.4)", background: "rgba(24,119,242,0.1)", color: "#5b9cf6", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
              Facebook
            </button>
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(getShareText())}`, "_blank", "noopener,noreferrer")}
              title="Share on WhatsApp"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(37,211,102,0.4)", background: "rgba(37,211,102,0.1)", color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button
              onClick={() => window.open(`https://reddit.com/submit?url=${encodeURIComponent("https://puzzlewarz.com")}&title=${encodeURIComponent(getShareText())}`, "_blank", "noopener,noreferrer,width=600,height=500")}
              title="Share on Reddit"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,69,0,0.4)", background: "rgba(255,69,0,0.1)", color: "#f97316", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
              Reddit
            </button>
            <button
              onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent("https://puzzlewarz.com")}&text=${encodeURIComponent(getShareText())}`, "_blank", "noopener,noreferrer,width=600,height=500")}
              title="Share on Telegram"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(0,136,204,0.4)", background: "rgba(0,136,204,0.1)", color: "#38bdf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              Telegram
            </button>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(getShareText()); setFreqCopied(true); setTimeout(() => setFreqCopied(false), 2500); } catch { /* ignore */ } }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: freqCopied ? "1px solid rgba(125,249,170,0.5)" : "1px solid rgba(255,255,255,0.15)", background: freqCopied ? "rgba(125,249,170,0.12)" : "rgba(255,255,255,0.04)", color: freqCopied ? "#7DF9AA" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {freqCopied ? "✓ Copied!" : "📋 Copy"}
            </button>
          </div>
        </div>

          {/* Sign-up nudge for guests */}
          {isGuest && (
            <div className="rounded-xl p-4 border text-center" style={{ background: "rgba(234,179,8,0.08)", borderColor: "rgba(234,179,8,0.25)" }}>
              <p className="text-sm font-semibold text-white mb-1">💾 Your score isn&apos;t saved</p>
              <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>Create a free account to track your daily streak, save points, and appear on the leaderboard.</p>
              <a href="/auth/register" className="inline-block rounded-lg px-4 py-2 text-sm font-bold" style={{ background: "rgba(234,179,8,0.2)", border: "1px solid rgba(234,179,8,0.4)", color: "#fde68a" }}>
                Create Account — It&apos;s Free →
              </a>
            </div>
          )}
        </div>
        {launchCtaModal}
      </>
    );
  }

  // ── Input phase ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 w-full max-w-lg mx-auto">
      {/* Question */}
      <div className="rounded-2xl p-5 border text-center" style={{ background: "rgba(56,145,166,0.08)", borderColor: "rgba(56,145,166,0.3)" }}>
        <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: TEAL }}>TODAY&apos;S QUESTION</p>
        <p className="text-xl font-bold text-white leading-snug">{question.question}</p>
      </div>

      {/* Instructions */}
      <p className="text-sm text-center" style={{ color: "#94a3b8" }}>
        Name up to {MAX_FREQUENCY_ANSWERS} things you think the crowd will say.
        Score = % of players who agreed with you.
      </p>

      {/* Answer inputs */}
      <div className="flex flex-col gap-2">
        {inputs.map((val, i) => {
          const isTooLong = !isWithinFrequencyWordLimit(val);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold shrink-0" style={{ color: "#64748b" }}>{i + 1}</span>
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                value={val}
                placeholder={i === 0 ? "Your best answer…" : "Another answer…"}
                maxLength={60}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none transition-all"
                style={{
                  background: isTooLong ? "rgba(239,68,68,0.08)" : activeIndex === i ? "rgba(56,145,166,0.15)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${isTooLong ? "#ef4444" : activeIndex === i ? TEAL : "rgba(255,255,255,0.1)"}`,
                }}
                onFocus={() => setActiveIndex(i)}
                onChange={(e) => handleInputChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoComplete="off"
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || filledAnswers.length === 0 || !!tooLongAnswer}
        className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100"
        style={{ background: TEAL }}
      >
        {submitting ? "Submitting…" : `Lock In ${filledAnswers.length} Answer${filledAnswers.length !== 1 ? "s" : ""}`}
      </button>

      <p className="text-xs text-center" style={{ color: "#475569" }}>
        Results revealed daily · Free to play
      </p>
      <p className="text-xs text-center" style={{ color: "#475569" }}>
        Answers are limited to {MAX_FREQUENCY_ANSWER_WORDS} words — short & simple matches the crowd best
      </p>
    </div>
  );
}

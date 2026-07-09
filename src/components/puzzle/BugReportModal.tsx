"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BugReportModalProps {
  puzzleId: string;
  puzzleTitle: string;
  onClose: () => void;
}

// Compact in-place bug report form, opened from PuzzleBugReportButton. Puzzle identity is
// fixed (no search picker) — the whole point is skipping the hundreds-of-puzzles dropdown on
// /report-bug by already knowing which puzzle you're looking at. Posts to the same
// POST /api/bug-reports endpoint that page uses, just always supplying puzzleId.
export default function BugReportModal({ puzzleId, puzzleTitle, onClose }: BugReportModalProps) {
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = description.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          puzzleId,
          contactEmail: contactEmail.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 20000, background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report a bug"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto"
        style={{ background: "#0a0e14", border: "1px solid rgba(56,145,166,0.3)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
      >
        {submitted ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-black text-white mb-1.5">Thanks — report sent</h2>
            <p className="text-sm mb-6" style={{ color: "#9CA3AF" }}>
              We&apos;ll take a look at <span style={{ color: "#3891A6" }}>{puzzleTitle}</span>.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-bold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#3891A6", color: "#020202" }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-black text-white">🐞 Report a Bug</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 w-7 h-7 rounded-full grid place-items-center transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: "#9CA3AF" }}
              >
                ×
              </button>
            </div>

            <div
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg mb-4"
              style={{ background: "rgba(56,145,166,0.1)", border: "1px solid rgba(56,145,166,0.35)" }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>🧩</span>
              <span className="text-sm font-semibold text-white truncate">{puzzleTitle}</span>
            </div>

            <label className="block text-sm font-bold text-white mb-2">What happened?</label>
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you expect, and what happened instead?"
              rows={4}
              className="w-full px-3.5 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none resize-none mb-4"
              style={{ backgroundColor: "#111820", border: "1px solid rgba(56,145,166,0.35)" }}
            />

            <label className="block text-sm font-bold text-white mb-1.5">
              Contact email <span className="font-normal" style={{ color: "#6B7280" }}>(optional)</span>
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none mb-4"
              style={{ backgroundColor: "#111820", border: "1px solid rgba(56,145,166,0.35)" }}
            />

            {error && (
              <div
                className="mb-4 px-3.5 py-2.5 rounded-lg text-sm"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 rounded-lg font-bold tracking-wide transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "#3891A6", color: "#020202" }}
            >
              {submitting ? "Sending…" : "Send Report"}
            </button>

            <p className="text-xs text-center mt-3" style={{ color: "#4B5563" }}>
              Wrong puzzle?{" "}
              <Link href="/report-bug" className="underline" style={{ color: "#6B7280" }}>
                Use the full report form
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

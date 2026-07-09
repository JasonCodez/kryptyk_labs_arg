"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

interface PuzzleOption {
  id: string;
  title: string;
  puzzleType: string;
  categoryName: string | null;
}

type Mode = "puzzle" | "other";

export default function ReportBugPage() {
  const [puzzles, setPuzzles] = useState<PuzzleOption[]>([]);
  const [loadingPuzzles, setLoadingPuzzles] = useState(true);

  const [mode, setMode] = useState<Mode>("puzzle");
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleOption | null>(null);
  const [otherLocation, setOtherLocation] = useState("");

  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/puzzles/report-options")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPuzzles(Array.isArray(data) ? data : []))
      .catch(() => setPuzzles([]))
      .finally(() => setLoadingPuzzles(false));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filteredPuzzles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q
      ? puzzles.filter((p) => p.title.toLowerCase().includes(q))
      : puzzles;
    return pool.slice(0, 30);
  }, [puzzles, search]);

  const canSubmit =
    description.trim().length > 0 &&
    (mode === "puzzle" ? !!selectedPuzzle : otherLocation.trim().length > 0) &&
    !submitting;

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
          puzzleId: mode === "puzzle" ? selectedPuzzle?.id ?? null : null,
          otherLocation: mode === "other" ? otherLocation.trim() : "",
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
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-20 px-4" style={{ backgroundColor: "#020202" }}>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 pb-8" style={{ borderBottom: "1px solid rgba(56,145,166,0.2)" }}>
            <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#3891A6" }}>Support</p>
            <h1 className="text-4xl font-black mb-4" style={{ color: "#fff" }}>🐞 Report a Bug</h1>
            <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
              Puzzle Warz is in Early Access — you&apos;ll run into rough edges. Tell us where,
              and we&apos;ll get it fixed. You don&apos;t need an account to send a report.
            </p>
          </div>

          {submitted ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: "rgba(56,211,153,0.06)", border: "1px solid rgba(56,211,153,0.3)" }}
            >
              <div className="text-5xl mb-3">✅</div>
              <h2 className="text-xl font-black text-white mb-2">Thanks — report sent</h2>
              <p className="text-sm mb-6" style={{ color: "#9CA3AF" }}>
                We&apos;ll take a look. If you left a contact email and we need more details, we&apos;ll reach out.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/puzzles"
                  className="px-5 py-2.5 rounded-lg font-bold text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#3891A6", color: "#020202" }}
                >
                  Back to Puzzles
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setSelectedPuzzle(null);
                    setOtherLocation("");
                    setDescription("");
                    setContactEmail("");
                    setSearch("");
                  }}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#E5E7EB" }}
                >
                  Report Another Bug
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl p-6 sm:p-8"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)" }}
            >
              {/* Where did this happen */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-white mb-3">Where did this happen?</label>

                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setMode("puzzle")}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={
                      mode === "puzzle"
                        ? { background: "#3891A6", color: "#020202" }
                        : { background: "rgba(255,255,255,0.05)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.1)" }
                    }
                  >
                    🧩 A specific puzzle
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("other")}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={
                      mode === "other"
                        ? { background: "#3891A6", color: "#020202" }
                        : { background: "rgba(255,255,255,0.05)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.1)" }
                    }
                  >
                    📍 Somewhere else
                  </button>
                </div>

                {mode === "puzzle" ? (
                  <div ref={pickerRef} className="relative">
                    {selectedPuzzle ? (
                      <div
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
                        style={{ background: "rgba(56,145,166,0.1)", border: "1px solid rgba(56,145,166,0.35)" }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{selectedPuzzle.title}</p>
                          <p className="text-xs" style={{ color: "#3891A6" }}>{getPuzzleTypeLabel(selectedPuzzle.puzzleType)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedPuzzle(null); setSearch(""); }}
                          aria-label="Clear selected puzzle"
                          className="shrink-0 w-7 h-7 rounded-full grid place-items-center transition-colors"
                          style={{ background: "rgba(255,255,255,0.06)", color: "#9CA3AF" }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
                          onFocus={() => setDropdownOpen(true)}
                          placeholder={loadingPuzzles ? "Loading puzzles…" : "Search for a puzzle by title…"}
                          disabled={loadingPuzzles}
                          className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
                          style={{ backgroundColor: "#111820", border: "1px solid rgba(56,145,166,0.35)" }}
                        />
                        {dropdownOpen && filteredPuzzles.length > 0 && (
                          <div
                            className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg shadow-2xl"
                            style={{ background: "#0c1420", border: "1px solid rgba(56,145,166,0.3)" }}
                          >
                            {filteredPuzzles.map((p) => (
                              <button
                                type="button"
                                key={p.id}
                                onClick={() => {
                                  setSelectedPuzzle(p);
                                  setDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-3"
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56,145,166,0.1)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <span className="text-sm text-white truncate">{p.title}</span>
                                <span className="text-xs shrink-0" style={{ color: "#6B7280" }}>
                                  {getPuzzleTypeLabel(p.puzzleType)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {dropdownOpen && !loadingPuzzles && search.trim() && filteredPuzzles.length === 0 && (
                          <div
                            className="absolute z-10 mt-1.5 w-full rounded-lg px-4 py-3 text-sm"
                            style={{ background: "#0c1420", border: "1px solid rgba(56,145,166,0.3)", color: "#6B7280" }}
                          >
                            No puzzles match &quot;{search}&quot;. Try{" "}
                            <button type="button" onClick={() => setMode("other")} className="underline" style={{ color: "#3891A6" }}>
                              Somewhere else
                            </button>{" "}
                            instead.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={otherLocation}
                    onChange={(e) => setOtherLocation(e.target.value)}
                    placeholder="e.g. leaderboards page, sign-up form, homepage on mobile…"
                    className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none"
                    style={{ backgroundColor: "#111820", border: "1px solid rgba(56,145,166,0.35)" }}
                  />
                )}
              </div>

              {/* What happened */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-white mb-3">What happened?</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you expect to happen, and what happened instead? Steps to reproduce help a lot."
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none resize-none"
                  style={{ backgroundColor: "#111820", border: "1px solid rgba(56,145,166,0.35)" }}
                />
              </div>

              {/* Contact email */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-white mb-1.5">
                  Contact email <span className="font-normal" style={{ color: "#6B7280" }}>(optional)</span>
                </label>
                <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
                  Only used if we need more details to track the bug down.
                </p>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none"
                  style={{ backgroundColor: "#111820", border: "1px solid rgba(56,145,166,0.35)" }}
                />
              </div>

              {error && (
                <div
                  className="mb-6 px-4 py-3 rounded-lg text-sm"
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
            </form>
          )}
        </div>
      </main>
    </>
  );
}

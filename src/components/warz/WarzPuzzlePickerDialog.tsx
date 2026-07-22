"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ChevronRight, TriangleAlert, RefreshCw } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

export interface EligiblePuzzle {
  id: string;
  title: string;
  difficulty: string;
  puzzleType: string;
  category?: { name: string } | null;
}

export interface WarzPuzzlePickerDialogProps {
  open: boolean;
  puzzles: EligiblePuzzle[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (puzzle: EligiblePuzzle) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

const TYPE_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "sudoku", label: "Sudoku" },
  { key: "word_crack", label: "Hidden Word" },
  { key: "word_search", label: "Word Trove" },
  { key: "jigsaw", label: "Jigsaw" },
];

export default function WarzPuzzlePickerDialog({
  open,
  puzzles,
  loading,
  error,
  onRetry,
  onSelect,
  onClose,
  returnFocusRef,
}: WarzPuzzlePickerDialogProps) {
  const headingId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const reduceMotion = useAppReducedMotion();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setTypeFilter("all");

    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const returnFocusEl = returnFocusRef.current;
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusEl?.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return puzzles.filter((puzzle) => {
      const matchesType = typeFilter === "all" || puzzle.puzzleType === typeFilter;
      const matchesQuery = !query || puzzle.title.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [puzzles, search, typeFilter]);

  if (typeof document === "undefined") return null;

  const duration = reduceMotion ? 0 : 0.2;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "color-mix(in srgb, black 70%, transparent)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className="pw-surface flex w-full max-w-lg flex-col rounded-2xl"
            style={{ border: "1px solid var(--pw-border-default)", maxHeight: "80vh" }}
            initial={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration }}
          >
            <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: "var(--pw-border-subtle)" }}>
              <div>
                <h2 id={headingId} className="text-lg font-extrabold" style={{ color: "var(--pw-text-primary)" }}>
                  Choose your puzzle
                </h2>
                <p id={descriptionId} className="mt-0.5 text-xs" style={{ color: "var(--pw-text-muted)" }}>
                  Only puzzles you haven&rsquo;t attempted are available for Warz challenges.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close puzzle picker"
                className="inline-flex shrink-0 items-center justify-center rounded-full"
                style={{ width: 46, height: 46, color: "var(--pw-text-muted)" }}
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-2 border-b p-4" style={{ borderColor: "var(--pw-border-subtle)" }}>
              <label htmlFor={`${headingId}-search`} className="text-xs font-semibold" style={{ color: "var(--pw-text-muted)" }}>
                Search eligible puzzles
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--pw-text-muted)" }}
                />
                <input
                  id={`${headingId}-search`}
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search eligible puzzles…"
                  className="min-h-11 w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none"
                  style={{
                    minHeight: 46,
                    background: "var(--pw-surface-2)",
                    border: "1px solid var(--pw-border-default)",
                    color: "var(--pw-text-primary)",
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map((filter) => {
                  const active = typeFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTypeFilter(filter.key)}
                      className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold"
                      style={{
                        minHeight: 46,
                        background: active
                          ? "color-mix(in srgb, var(--pw-brand-secondary) 20%, transparent)"
                          : "var(--pw-surface-2)",
                        border: `1px solid ${active ? "var(--pw-brand-secondary)" : "var(--pw-border-default)"}`,
                        color: active ? "var(--pw-brand-secondary)" : "var(--pw-text-muted)",
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p role="status" className="py-8 text-center text-sm" style={{ color: "var(--pw-text-muted)" }}>
                  Loading eligible puzzles…
                </p>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <TriangleAlert aria-hidden="true" size={28} style={{ color: "var(--pw-error-text)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--pw-text-primary)" }}>
                    We couldn&rsquo;t load eligible puzzles.
                  </p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold"
                    style={{
                      minHeight: 46,
                      color: "var(--pw-brand-primary)",
                      background: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
                    }}
                  >
                    <RefreshCw aria-hidden="true" size={15} />
                    Try again
                  </button>
                </div>
              ) : puzzles.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "var(--pw-text-muted)" }}>
                  You&rsquo;ve already attempted all available Warz puzzles.
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "var(--pw-text-muted)" }}>
                  No eligible puzzles match your search.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filtered.map((puzzle) => (
                    <li key={puzzle.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(puzzle)}
                        className="flex w-full min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-3 text-left"
                        style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold" style={{ color: "var(--pw-text-primary)" }}>
                            {puzzle.title}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs" style={{ color: "var(--pw-text-muted)" }}>
                            <span>{getPuzzleTypeLabel(puzzle.puzzleType)}</span>
                            {puzzle.category?.name && <span>{puzzle.category.name}</span>}
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" size={18} className="shrink-0" style={{ color: "var(--pw-text-muted)" }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

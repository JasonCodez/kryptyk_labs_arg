"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, X, TriangleAlert, RefreshCw, Target } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

export interface WarzOpponentSearchResult {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

export interface WarzOpponentSearchProps {
  selectedOpponent: WarzOpponentSearchResult | null;
  disabled?: boolean;
  onSelect: (user: WarzOpponentSearchResult) => void;
  onRemove: () => void;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

/**
 * Owns its own search input, debounce, request lifecycle, and combobox/listbox
 * semantics against the existing `/api/users/search` endpoint. Purely
 * self-contained — the parent only learns of a final selection or removal.
 */
export default function WarzOpponentSearch({
  selectedOpponent,
  disabled = false,
  onSelect,
  onRemove,
}: WarzOpponentSearchProps) {
  const reduceMotion = useAppReducedMotion();
  const inputId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WarzOpponentSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = (trimmed: string) => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const seq = ++requestSeqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");

    fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}&limit=6`, { signal: controller.signal })
      .then(async (res) => {
        if (seq !== requestSeqRef.current) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = await res.json();
        if (seq !== requestSeqRef.current) return;
        setResults(data.users ?? []);
        setStatus("idle");
        setHighlightedIndex(-1);
      })
      .catch((err) => {
        if (seq !== requestSeqRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
      });
  };

  // Fires the debounced search once the query is long enough. When the query
  // is too short, `handleQueryChange` has already reset local state
  // synchronously (in the event handler, not here), so this effect has
  // nothing left to do for that case.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const trimmedQuery = query.trim();
  const showResults = open && trimmedQuery.length >= MIN_QUERY_LENGTH;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (value.trim().length < MIN_QUERY_LENGTH) {
      requestSeqRef.current += 1;
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return;
    }
    setOpen(true);
  };

  const handleRetry = () => {
    if (status === "loading") return;
    runSearch(trimmedQuery);
  };

  const selectResult = (user: WarzOpponentSearchResult) => {
    abortRef.current?.abort();
    requestSeqRef.current += 1;
    setQuery("");
    setResults([]);
    setStatus("idle");
    setOpen(false);
    setHighlightedIndex(-1);
    onSelect(user);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        event.preventDefault();
        selectResult(results[highlightedIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const activeOptionId = highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  if (selectedOpponent) {
    return (
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex items-center justify-between gap-3 rounded-xl p-3"
        style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
      >
        <span className="min-w-0">
          <span
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--pw-brand-secondary)" }}
          >
            <Target aria-hidden="true" size={13} />
            Targeted challenge
          </span>
          <span className="block truncate text-sm font-semibold" style={{ color: "var(--pw-text-primary)" }}>
            @{selectedOpponent.username}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-bold"
          style={{ color: "var(--pw-text-muted)", background: "var(--pw-surface-1)" }}
        >
          <X aria-hidden="true" size={14} />
          Remove opponent
        </button>
      </motion.div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-semibold" style={{ color: "var(--pw-text-muted)" }}>
        Invite a specific player
      </label>
      <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
        Leave blank to make the challenge open to anyone.
      </p>
      <div className="relative">
        <Search
          aria-hidden="true"
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--pw-text-muted)" }}
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          disabled={disabled}
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by username…"
          className="min-h-11 w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none disabled:opacity-60"
          style={{
            minHeight: 46,
            background: "var(--pw-surface-2)",
            border: "1px solid var(--pw-border-default)",
            color: "var(--pw-text-primary)",
          }}
        />
      </div>

      {showResults && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Player search results"
          className="max-h-60 overflow-y-auto rounded-lg"
          style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
        >
          {status === "loading" ? (
            <li role="status" className="p-3 text-center text-sm" style={{ color: "var(--pw-text-muted)" }}>
              Searching players…
            </li>
          ) : status === "error" ? (
            <li className="flex flex-col items-center gap-2 p-3 text-center">
              <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--pw-error-text)" }}>
                <TriangleAlert aria-hidden="true" size={14} />
                We couldn&rsquo;t search players.
              </span>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-bold"
                style={{ color: "var(--pw-brand-primary)", background: "var(--pw-surface-1)" }}
              >
                <RefreshCw aria-hidden="true" size={13} />
                Try again
              </button>
            </li>
          ) : results.length === 0 ? (
            <li className="p-3 text-center text-sm" style={{ color: "var(--pw-text-muted)" }}>
              No players found.
            </li>
          ) : (
            results.map((user, index) => (
              <li
                key={user.id}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                <button
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectResult(user)}
                  className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  style={{
                    background: index === highlightedIndex ? "var(--pw-surface-hover)" : "transparent",
                    color: "var(--pw-text-primary)",
                  }}
                >
                  @{user.username}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

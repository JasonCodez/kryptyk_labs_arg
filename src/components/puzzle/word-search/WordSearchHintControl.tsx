"use client";

import Link from "next/link";
import Pressable from "@/components/juice/Pressable";

interface WordSearchHintControlProps {
  tokens: number;
  pending: boolean;
  disabled: boolean;
  onHint: () => void;
}

function IconHintBulb() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 3.5a5.5 5.5 0 0 0-3.2 9.98c.55.4.87 1.02.87 1.68V16h4.66v-.84c0-.66.32-1.28.87-1.68A5.5 5.5 0 0 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.8 19h4.4M10.4 20.5h3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function WordSearchHintControl({ tokens, pending, disabled, onHint }: WordSearchHintControlProps) {
  if (tokens < 1) {
    return (
      <div className="word-search-hint-control">
        <Pressable type="button" className="word-search-hint-button" disabled aria-label="No Hint Tokens">
          <IconHintBulb />
          <span className="word-search-hint-copy">
            <span className="word-search-hint-label">No Hint Tokens</span>
          </span>
        </Pressable>
        <Link href="/store" className="word-search-hint-store-link">
          Get Hint Tokens
        </Link>
      </div>
    );
  }

  const isDisabled = disabled || pending;
  const label = pending ? "Finding a word…" : "Hint";
  const supportingText = pending ? "" : `${tokens} token${tokens !== 1 ? "s" : ""}`;

  return (
    <div className="word-search-hint-control">
      <Pressable
        type="button"
        className="word-search-hint-button"
        disabled={isDisabled}
        onClick={onHint}
        aria-busy={pending}
      >
        <IconHintBulb />
        <span className="word-search-hint-copy">
          <span className="word-search-hint-label">{label}</span>
          {supportingText && <span className="word-search-hint-tokens">{supportingText}</span>}
        </span>
      </Pressable>
    </div>
  );
}

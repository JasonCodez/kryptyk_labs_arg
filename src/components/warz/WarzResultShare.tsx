"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";

interface WarzResultShareProps {
  title: string;
  text: string;
  url: string;
  disabled?: boolean;
}

type ShareStatus = "idle" | "pending" | "shared" | "copied" | "error";

export default function WarzResultShare({
  title,
  text,
  url,
  disabled = false,
}: WarzResultShareProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const shareInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const showTemporarySuccess = (next: "shared" | "copied") => {
    if (!mountedRef.current) return;
    setStatus(next);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null;
      if (mountedRef.current) setStatus("idle");
    }, 2_000);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    showTemporarySuccess("copied");
  };

  const handleShare = async () => {
    if (disabled || !text || shareInFlightRef.current) return;
    shareInFlightRef.current = true;
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setStatus("pending");

    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title, text, url });
          showTemporarySuccess("shared");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            if (mountedRef.current) setStatus("idle");
            return;
          }
        }
      }
      await copyToClipboard();
    } catch {
      if (mountedRef.current) setStatus("error");
    } finally {
      shareInFlightRef.current = false;
    }
  };

  const label =
    status === "pending"
      ? "Sharing…"
      : status === "shared"
        ? "Shared"
        : status === "copied"
          ? "Copied"
          : "Share Result";

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleShare}
        disabled={disabled || status === "pending"}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          minHeight: 48,
          color: "var(--pw-bg-base)",
          background: "var(--pw-brand-secondary)",
          ["--tw-ring-color" as string]: "var(--pw-brand-secondary)",
          ["--tw-ring-offset-color" as string]: "var(--pw-bg-base)",
        }}
      >
        <Share2 aria-hidden="true" size={18} />
        {label}
      </button>
      <p
        aria-live="polite"
        className="mt-2 min-h-5 text-center text-xs"
        style={{ color: status === "error" ? "var(--pw-error-text)" : "var(--pw-text-muted)" }}
      >
        {status === "error" ? "We couldn’t share this result." : ""}
      </p>
    </div>
  );
}

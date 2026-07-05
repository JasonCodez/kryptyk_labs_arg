"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Gates a forum-posting action behind the "read and accept the forum rules" modal, showing
 * it only the first time a user tries to post. `ensureAccepted()` resolves `true` immediately
 * if the user has already accepted (checked against the server, not just local state, so it
 * still works correctly across tabs/devices); otherwise it opens the modal and resolves once
 * the user accepts or dismisses it.
 */
export function useForumRulesGate() {
  const [accepted, setAccepted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/info")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.forumRulesAccepted) setAccepted(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const ensureAccepted = useCallback(async (): Promise<boolean> => {
    if (accepted) return true;
    // Re-check fresh rather than trusting possibly-stale local state — covers the case where
    // the initial check above hasn't resolved yet or acceptance happened in another tab.
    try {
      const res = await fetch("/api/user/info");
      if (res.ok) {
        const data = await res.json();
        if (data?.forumRulesAccepted) { setAccepted(true); return true; }
      }
    } catch {
      // fall through to showing the modal
    }
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setModalOpen(true);
    });
  }, [accepted]);

  const handleAccept = useCallback(async () => {
    setAccepting(true);
    try {
      await fetch("/api/user/forum-rules-accept", { method: "POST" });
    } catch {
      // non-fatal — the server-side check on the post route is the real enforcement;
      // worst case the user has to accept again next time.
    }
    setAccepting(false);
    setAccepted(true);
    setModalOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return { modalOpen, accepting, ensureAccepted, handleAccept, handleClose };
}

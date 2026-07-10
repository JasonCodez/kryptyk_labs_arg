"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  type: string;
  title?: string | null;
  message?: string | null;
  relatedId?: string | null;
  createdAt?: string | Date;
};

function parseRelatedId(relatedId?: string | null): { teamId: string; puzzleId: string } | null {
  if (!relatedId) return null;
  const parts = relatedId.split("::");
  if (parts.length < 2) return null;
  const teamId = parts[0];
  const puzzleId = parts[1];
  if (!teamId || !puzzleId) return null;
  return { teamId, puzzleId };
}

export default function TeamLobbyInviteModalProvider() {
  const router = useRouter();

  const [queue, setQueue] = useState<Notification[]>([]);
  const [busy, setBusy] = useState<"join" | "decline" | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  // Restore dismissed ids for this tab/session.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("dismissedTeamLobbyInviteNotifications");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          dismissedIdsRef.current = new Set(parsed.filter((x) => typeof x === "string"));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const current = useMemo(() => (queue.length > 0 ? queue[0] : null), [queue]);

  const enqueueInvite = (notif: any) => {
    try {
      if (!notif || notif.type !== "team_lobby_invite") return;
      if (!notif.id) return;
      if (!parseRelatedId(notif.relatedId)) return;

      if (dismissedIdsRef.current.has(notif.id)) return;
      if (seenIdsRef.current.has(notif.id)) return;
      seenIdsRef.current.add(notif.id);

      setQueue((prev) => {
        if ((prev || []).some((n) => n.id === notif.id)) return prev;
        return (prev || []).concat(notif);
      });
    } catch {
      // ignore
    }
  };

  // Listen for realtime notifications coming from the global socket (Providers dispatches `notificationReceived`).
  useEffect(() => {
    const handler = (e: any) => {
      enqueueInvite(e?.detail);
    };
    window.addEventListener("notificationReceived", handler as EventListener);
    return () => window.removeEventListener("notificationReceived", handler as EventListener);
     
  }, []);

  // On mount, also check unread notifications so invites show even if the socket event was missed.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/user/notifications?limit=25&skip=0&unreadOnly=true");
        if (!res.ok) return;
        const j = await res.json();
        const notifs: any[] = Array.isArray(j?.notifications) ? j.notifications : [];
        for (const n of notifs) {
          if (!mounted) return;
          enqueueInvite(n);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
     
  }, []);

  const dismissCurrent = () => {
    if (!current?.id) return;
    try {
      dismissedIdsRef.current.add(current.id);
      sessionStorage.setItem(
        "dismissedTeamLobbyInviteNotifications",
        JSON.stringify(Array.from(dismissedIdsRef.current))
      );
    } catch {
      // ignore
    }
    setQueue((prev) => (prev || []).slice(1));
  };

  const onJoin = async () => {
    if (!current) return;
    const parsed = parseRelatedId(current.relatedId);
    if (!parsed) return dismissCurrent();
    setBusy("join");
    try {
      const postLobbyAction = async (action: "join" | "create") => {
        const res = await fetch("/api/team/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, teamId: parsed.teamId, puzzleId: parsed.puzzleId }),
        });
        const payload = await res.json().catch(() => ({}));
        return { res, payload };
      };

      let { res, payload } = await postLobbyAction("join");

      if (!res.ok && payload?.activePuzzleId && typeof payload.activePuzzleId === "string") {
        const notice = encodeURIComponent(payload?.error || "A different team puzzle is currently active.");
        dismissCurrent();
        router.push(`/teams/${parsed.teamId}/lobby?puzzleId=${encodeURIComponent(payload.activePuzzleId)}&notice=${notice}`);
        return;
      }

      const joinError = String(payload?.error || "");
      const shouldCreate = !res.ok && res.status === 409 && /lobby not found/i.test(joinError);
      if (shouldCreate) {
        const createResult = await postLobbyAction("create");
        res = createResult.res;
        payload = createResult.payload;
      }

      if (!res.ok) {
        const notice = encodeURIComponent(payload?.error || "Unable to join this lobby right now.");
        const destinationPuzzleId = typeof payload?.activePuzzleId === "string" ? payload.activePuzzleId : parsed.puzzleId;
        dismissCurrent();
        router.push(`/teams/${parsed.teamId}/lobby?puzzleId=${encodeURIComponent(destinationPuzzleId)}&notice=${notice}`);
        return;
      }

      // Ask bell to refresh unread count (best effort).
      try {
        window.dispatchEvent(new Event("notificationsRead"));
      } catch {
        // ignore
      }

      router.push(`/teams/${parsed.teamId}/lobby?puzzleId=${encodeURIComponent(parsed.puzzleId)}`);
      dismissCurrent();
    } catch {
      // If something goes wrong, still navigate so the user can try to join.
      try {
        router.push(`/teams/${parsed.teamId}/lobby?puzzleId=${encodeURIComponent(parsed.puzzleId)}`);
      } catch {
        // ignore
      }
      dismissCurrent();
    } finally {
      setBusy(null);
    }
  };

  const onDecline = async () => {
    if (!current) return;
    const parsed = parseRelatedId(current.relatedId);
    if (!parsed) return dismissCurrent();
    setBusy("decline");
    try {
      await fetch("/api/team/lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "declineInvite", teamId: parsed.teamId, puzzleId: parsed.puzzleId }),
      });

      try {
        window.dispatchEvent(new Event("notificationsRead"));
      } catch {
        // ignore
      }

      dismissCurrent();
    } catch {
      dismissCurrent();
    } finally {
      setBusy(null);
    }
  };

  if (!current) return null;

  const title = current.title || "Team Lobby Invite";
  const message = current.message || "You have been invited to join a team lobby.";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => dismissCurrent()} />

      <div className="relative w-full sm:max-w-lg rounded-lg shadow-lg overflow-hidden bg-slate-900 border border-slate-700">
        <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
          <h3 className="text-white text-lg font-semibold">{title}</h3>
          <button
            onClick={() => dismissCurrent()}
            className="px-2 py-1 rounded bg-slate-700 text-white hover:opacity-90 text-sm"
            disabled={!!busy}
            aria-label="Dismiss"
          >
            Not now
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-200 mb-4">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onDecline}
              className="px-4 py-2 rounded bg-slate-700 text-white hover:opacity-90 disabled:opacity-50"
              disabled={busy !== null}
            >
              Decline
            </button>
            <button
              onClick={onJoin}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:opacity-90 disabled:opacity-50"
              disabled={busy !== null}
            >
              Join Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

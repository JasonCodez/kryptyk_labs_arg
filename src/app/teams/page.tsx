"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CreateTeamModal } from "@/components/teams/CreateTeamModal";
import PendingInvitations from "@/components/teams/PendingInvitations";
import PageContainer from "@/components/ui/PageContainer";
import TeamsHubContent, {
  normalizeTeamsPayload,
  type TeamsHubTeam,
  type TeamsHubViewMode,
} from "@/components/teams/TeamsHubContent";

type TeamsLoadStatus = "idle" | "loading" | "ready" | "error";

export default function TeamsPage() {
  const { data: session, status } = useSession();

  const [teams, setTeams] = useState<TeamsHubTeam[]>([]);
  const [teamsLoadStatus, setTeamsLoadStatus] = useState<TeamsLoadStatus>("idle");
  const [retrying, setRetrying] = useState(false);
  const [viewMode, setViewMode] = useState<TeamsHubViewMode>("mine");
  const [invitationCount, setInvitationCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);

  const mountedRef = useRef(false);
  const teamsRequestSeqRef = useRef(0);
  const teamsAbortRef = useRef<AbortController | null>(null);
  const retryInFlightRef = useRef(false);
  const invitationRequestSeqRef = useRef(0);
  const invitationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teamsRequestSeqRef.current += 1;
      teamsAbortRef.current?.abort();
      invitationRequestSeqRef.current += 1;
      invitationAbortRef.current?.abort();
    };
  }, []);

  const loadTeams = useCallback(async (markLoading: boolean = true) => {
    teamsAbortRef.current?.abort();
    const seq = ++teamsRequestSeqRef.current;
    const controller = new AbortController();
    teamsAbortRef.current = controller;

    // A retry keeps the error panel visible (with its own pending "Trying…"
    // button state) rather than being replaced by the full loading skeleton.
    if (markLoading) setTeamsLoadStatus("loading");

    const shouldApply = () => mountedRef.current && seq === teamsRequestSeqRef.current;

    try {
      const response = await fetch("/api/teams", { cache: "no-store", signal: controller.signal });
      if (!shouldApply()) return;

      if (!response.ok) {
        setTeamsLoadStatus("error");
        return;
      }

      const data = await response.json();
      if (!shouldApply()) return;

      const normalized = normalizeTeamsPayload(data);
      if (!normalized) {
        setTeamsLoadStatus("error");
        return;
      }

      setTeams(normalized);
      setTeamsLoadStatus("ready");
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || !shouldApply()) return;
      setTeamsLoadStatus("error");
    }
  }, []);

  const loadInvitationCount = useCallback(async () => {
    invitationAbortRef.current?.abort();
    const seq = ++invitationRequestSeqRef.current;
    const controller = new AbortController();
    invitationAbortRef.current = controller;

    const shouldApply = () => mountedRef.current && seq === invitationRequestSeqRef.current;

    try {
      const response = await fetch("/api/teams/invitations", { signal: controller.signal });
      if (!shouldApply()) return;
      if (!response.ok) {
        setInvitationCount(0);
        return;
      }
      const data = await response.json();
      if (!shouldApply()) return;
      setInvitationCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || !shouldApply()) return;
      setInvitationCount(0);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    void loadTeams();
    if (session?.user?.email) {
      void loadInvitationCount();
    } else {
      setInvitationCount(0);
    }
    setViewMode(session?.user?.email ? "mine" : "public");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email]);

  const retryLoadTeams = useCallback(async () => {
    if (retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    setRetrying(true);
    try {
      await loadTeams(false);
    } finally {
      retryInFlightRef.current = false;
      if (mountedRef.current) setRetrying(false);
    }
  }, [loadTeams]);

  const isAuthenticated = !!session?.user?.email;
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const effectiveLoadStatus = teamsLoadStatus === "ready" ? "ready" : teamsLoadStatus === "error" ? "error" : "loading";

  return (
    <div className="min-h-screen" style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}>
      <PageContainer size="catalog" className="pb-12 pt-6">
        <div className="mx-auto w-full max-w-6xl">
          <TeamsHubContent
            isAuthenticated={isAuthenticated}
            sessionUserId={sessionUserId}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            loadStatus={effectiveLoadStatus}
            teams={teams}
            retrying={retrying}
            onRetry={() => void retryLoadTeams()}
            invitationCount={invitationCount}
            onOpenInvitations={() => setShowInvitations(true)}
            onOpenCreateTeam={() => setShowCreateModal(true)}
          />
        </div>
      </PageContainer>

      <PendingInvitations
        isOpen={showInvitations}
        onClose={() => {
          setShowInvitations(false);
          void loadInvitationCount();
        }}
      />

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            void loadTeams();
          }}
        />
      )}
    </div>
  );
}

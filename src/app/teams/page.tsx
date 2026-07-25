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
  // undefined = authentication has not resolved for the first time yet;
  // null = the last resolved identity was anonymous; otherwise the last
  // resolved authenticated visitor's normalized email.
  const lastIdentityRef = useRef<string | null | undefined>(undefined);
  // Updated synchronously every render (not only inside the effect) so a
  // callback retained from an older, since-stale render always reads the
  // identity that is actually active right now rather than a captured one.
  const activeIdentityRef = useRef<string | null>(null);
  const invitationCountRef = useRef(0);
  // Which identity opened each authenticated-only surface, so a stale
  // success/close callback from a different identity can be told apart from
  // a legitimate one for the currently active identity.
  const createModalIdentityRef = useRef<string | null>(null);
  const invitationsPanelIdentityRef = useRef<string | null>(null);

  const invalidateTeamsRequest = useCallback(() => {
    teamsRequestSeqRef.current += 1;
    teamsAbortRef.current?.abort();
    teamsAbortRef.current = null;
  }, []);

  const invalidateInvitationRequest = useCallback(() => {
    invitationRequestSeqRef.current += 1;
    invitationAbortRef.current?.abort();
    invitationAbortRef.current = null;
  }, []);

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

  // A visitor is only actively authenticated when NextAuth has resolved to
  // "authenticated" AND a non-empty session email is present — retained
  // session data while status is still "loading" (e.g. mid session-refresh)
  // must never be treated as active authentication.
  const authenticatedEmail =
    status === "authenticated" && typeof session?.user?.email === "string" && session.user.email.trim()
      ? session.user.email.trim().toLowerCase()
      : null;

  // Synchronous, not effect-deferred: a callback captured by an earlier
  // render must observe the identity/count as of the render in which it is
  // actually invoked, not the one that created it.
  activeIdentityRef.current = authenticatedEmail;
  invitationCountRef.current = invitationCount;

  useEffect(() => {
    if (status === "loading") {
      // Authentication is uncertain — invalidate any in-flight requests so
      // a late response from before the refresh cannot apply, and hide
      // every authenticated-only surface until the session resolves again.
      invalidateTeamsRequest();
      invalidateInvitationRequest();
      setInvitationCount(0);
      setShowCreateModal(false);
      setShowInvitations(false);
      createModalIdentityRef.current = null;
      invitationsPanelIdentityRef.current = null;
      return;
    }

    const currentIdentity = authenticatedEmail;
    const previousIdentity = lastIdentityRef.current;
    const isFirstResolution = previousIdentity === undefined;
    const identityChanged = !isFirstResolution && currentIdentity !== previousIdentity;

    // Default to My Teams only on the very first resolution or when a
    // genuinely different identity (including anonymous) becomes active —
    // a same-identity refresh (e.g. authenticated A -> loading -> A) must
    // preserve whatever view the visitor already had selected.
    if (isFirstResolution || identityChanged) {
      setViewMode(currentIdentity ? "mine" : "public");
    }

    if (identityChanged) {
      // Moving to a different identity (a new account, or losing/gaining
      // authentication) must not leak the previous identity's open modals
      // or invitation count into the new one — clear the count immediately
      // rather than waiting for the new identity's request to resolve.
      setShowCreateModal(false);
      setShowInvitations(false);
      createModalIdentityRef.current = null;
      invitationsPanelIdentityRef.current = null;
      invalidateInvitationRequest();
      setInvitationCount(0);
    }

    lastIdentityRef.current = currentIdentity;

    void loadTeams();

    if (currentIdentity) {
      void loadInvitationCount();
    } else {
      invalidateInvitationRequest();
      setInvitationCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, authenticatedEmail]);

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

  // Every callback below is a stable function identity (empty deps), and
  // each reads activeIdentityRef/invitationCountRef at call time rather than
  // closing over the render that created it — a copy retained from an
  // earlier, now-stale render must always defer to whichever identity is
  // actually active when it eventually runs.
  const handleOpenCreateTeam = useCallback(() => {
    const identity = activeIdentityRef.current;
    if (!identity) return;
    createModalIdentityRef.current = identity;
    setShowCreateModal(true);
  }, []);

  const handleOpenInvitations = useCallback(() => {
    const identity = activeIdentityRef.current;
    if (!identity) return;
    if (invitationCountRef.current <= 0) return;
    invitationsPanelIdentityRef.current = identity;
    setShowInvitations(true);
  }, []);

  const handleCloseCreateTeam = useCallback(() => {
    createModalIdentityRef.current = null;
    setShowCreateModal(false);
  }, []);

  const handleCreateTeamSuccess = useCallback(() => {
    const openedFor = createModalIdentityRef.current;
    createModalIdentityRef.current = null;
    setShowCreateModal(false);

    // The account that opened Create Team must still be the active one for
    // its success to reload Teams — a request begun under a since-replaced
    // identity (logout, session refresh, a different account) must not
    // reload data that identity no longer owns.
    if (!openedFor || activeIdentityRef.current !== openedFor) return;

    void loadTeams();
  }, [loadTeams]);

  const handleCloseInvitations = useCallback(() => {
    const openedFor = invitationsPanelIdentityRef.current;
    invitationsPanelIdentityRef.current = null;
    setShowInvitations(false);

    const currentIdentity = activeIdentityRef.current;

    if (openedFor && currentIdentity === openedFor) {
      void loadInvitationCount();
      return;
    }

    if (!currentIdentity) {
      // Anonymous (or loading): no request, and make sure nothing is left
      // in flight for the identity that used to be active.
      invalidateInvitationRequest();
      setInvitationCount(0);
      return;
    }

    // A different authenticated identity is now active — its own invitation
    // request (if any) is already correctly scoped; a stale close from the
    // previous identity must not touch it.
  }, [invalidateInvitationRequest, loadInvitationCount]);

  const isAuthenticated = authenticatedEmail !== null;
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const effectiveLoadStatus =
    status === "loading"
      ? "loading"
      : teamsLoadStatus === "ready"
        ? "ready"
        : teamsLoadStatus === "error"
          ? "error"
          : "loading";

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
            onOpenInvitations={handleOpenInvitations}
            onOpenCreateTeam={handleOpenCreateTeam}
          />
        </div>
      </PageContainer>

      <PendingInvitations
        isOpen={isAuthenticated && showInvitations}
        onClose={handleCloseInvitations}
      />

      {isAuthenticated && showCreateModal && (
        <CreateTeamModal
          onClose={handleCloseCreateTeam}
          onSuccess={handleCreateTeamSuccess}
        />
      )}
    </div>
  );
}

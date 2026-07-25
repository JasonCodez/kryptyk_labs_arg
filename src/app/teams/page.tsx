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

// Identifies one specific opening of an authenticated-only surface (Create
// Team / Pending Invitations) — identity alone is not enough to tell two
// modal/panel generations apart (e.g. account A opens, account B opens a
// replacement while A's request is still in flight), so every opening gets
// its own monotonically increasing generation number.
interface AuthenticatedSurfaceContext {
  identity: string;
  generation: number;
}

function sameSurfaceContext(
  current: AuthenticatedSurfaceContext | null,
  candidate: AuthenticatedSurfaceContext
): boolean {
  return current !== null && current.identity === candidate.identity && current.generation === candidate.generation;
}

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
  // Monotonically increasing per surface — never reset, even across
  // identity transitions, so a generation from an older identity can never
  // become valid again by coincidence.
  const createSurfaceGenerationRef = useRef(0);
  const invitationsSurfaceGenerationRef = useRef(0);
  // The context that actually opened each currently-open surface, so a
  // same-shaped callback from a *different* opening (a different account,
  // or an earlier opening by the same account) can be told apart from the
  // legitimate callback for the surface that is actually on screen.
  const createSurfaceContextRef = useRef<AuthenticatedSurfaceContext | null>(null);
  const invitationsSurfaceContextRef = useRef<AuthenticatedSurfaceContext | null>(null);

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
      // A retained callback invoked after unmount must find nothing to
      // work with: no active identity, no positive count, no matchable
      // surface context.
      activeIdentityRef.current = null;
      invitationCountRef.current = 0;
      createSurfaceContextRef.current = null;
      invitationsSurfaceContextRef.current = null;
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
      createSurfaceContextRef.current = null;
      invitationsSurfaceContextRef.current = null;
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
      // Generation counters themselves are never reset, so an old
      // generation can never accidentally match a future one.
      setShowCreateModal(false);
      setShowInvitations(false);
      createSurfaceContextRef.current = null;
      invitationsSurfaceContextRef.current = null;
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

  // Every callback below is a stable function identity (empty/fixed deps).
  // The two "open" callbacks read activeIdentityRef/invitationCountRef at
  // call time and mint a fresh surface context. The "close"/"success"
  // callbacks are always invoked with the exact context that was rendered
  // for that surface instance (see the JSX below) and verify it still
  // matches the live context ref before doing anything — a callback bound
  // to an older generation (a previous account, or a previous opening by
  // the same account) can therefore never affect a newer one.
  const handleOpenCreateTeam = useCallback(() => {
    if (!mountedRef.current) return;
    const identity = activeIdentityRef.current;
    if (!identity) return;
    createSurfaceContextRef.current = { identity, generation: ++createSurfaceGenerationRef.current };
    setShowCreateModal(true);
  }, []);

  const handleOpenInvitations = useCallback(() => {
    if (!mountedRef.current) return;
    const identity = activeIdentityRef.current;
    if (!identity) return;
    if (invitationCountRef.current <= 0) return;
    invitationsSurfaceContextRef.current = { identity, generation: ++invitationsSurfaceGenerationRef.current };
    setShowInvitations(true);
  }, []);

  const handleCloseCreateTeam = useCallback((context: AuthenticatedSurfaceContext) => {
    if (!mountedRef.current) return;
    if (!sameSurfaceContext(createSurfaceContextRef.current, context)) return;
    createSurfaceContextRef.current = null;
    setShowCreateModal(false);
  }, []);

  const handleCreateTeamSuccess = useCallback((context: AuthenticatedSurfaceContext) => {
    if (!mountedRef.current) return;
    if (!sameSurfaceContext(createSurfaceContextRef.current, context)) return;
    // Defense in depth: the context check above already implies the
    // identity matches (a context is only ever minted for the identity
    // active at open time, and identity changes clear the context), but
    // the active identity is re-checked explicitly per spec.
    if (activeIdentityRef.current !== context.identity) return;
    createSurfaceContextRef.current = null;
    setShowCreateModal(false);
    void loadTeams();
  }, [loadTeams]);

  const handleCloseInvitations = useCallback((context: AuthenticatedSurfaceContext) => {
    if (!mountedRef.current) return;
    if (!sameSurfaceContext(invitationsSurfaceContextRef.current, context)) return;
    invitationsSurfaceContextRef.current = null;
    setShowInvitations(false);

    const currentIdentity = activeIdentityRef.current;

    if (currentIdentity === context.identity) {
      void loadInvitationCount();
      return;
    }

    if (!currentIdentity) {
      // Anonymous (or loading): no request, and make sure nothing is left
      // in flight for the identity that used to be active.
      invalidateInvitationRequest();
      setInvitationCount(0);
    }

    // Otherwise a different authenticated identity is now active — its own
    // invitation request (if any) is already correctly scoped; a stale
    // close from the previous identity must not touch it.
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

  // Captured once per render so the JSX below binds each rendered surface
  // instance's callbacks to the exact context that opened it, rather than
  // to whatever the ref happens to contain by the time the callback runs.
  const renderedCreateContext = createSurfaceContextRef.current;
  const renderedInvitationsContext = invitationsSurfaceContextRef.current;

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
        key={renderedInvitationsContext ? `${renderedInvitationsContext.identity}:${renderedInvitationsContext.generation}` : "closed"}
        isOpen={isAuthenticated && showInvitations && renderedInvitationsContext !== null}
        onClose={() => {
          if (renderedInvitationsContext) handleCloseInvitations(renderedInvitationsContext);
        }}
      />

      {isAuthenticated && showCreateModal && renderedCreateContext && (
        <CreateTeamModal
          key={`${renderedCreateContext.identity}:${renderedCreateContext.generation}`}
          onClose={() => handleCloseCreateTeam(renderedCreateContext)}
          onSuccess={() => handleCreateTeamSuccess(renderedCreateContext)}
        />
      )}
    </div>
  );
}

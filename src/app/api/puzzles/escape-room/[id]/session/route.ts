import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEscapeRoomTeamContext } from "@/lib/escapeRoomTeamAuth";
import { getLobbyLeaderId } from "@/lib/teamLobbyStore";

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

type InventoryLocksMap = Record<
  string,
  {
    lockedBy: string;
    lockedByName?: string | null;
    lockedAt: string;
    expiresAt?: string | null;
  }
>;

type BriefingAcksMap = Record<string, string>;

async function emitEscapeSession(teamId: string, puzzleId: string, payload: any) {
  try {
    const { postToSocket } = await import("@/lib/socket-client");
    const room = `escape:${teamId}::${puzzleId}`;
    await postToSocket("/emit", { room, event: "escapeSessionUpdated", payload });
  } catch {
    // non-fatal
  }
}

async function emitEscapeActivity(teamId: string, puzzleId: string, payload: any) {
  try {
    const { postToSocket } = await import("@/lib/socket-client");
    const room = `escape:${teamId}::${puzzleId}`;
    await postToSocket("/emit", { room, event: "escapeActivity", payload });
  } catch {
    // non-fatal
  }
}

function makeActivityId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const body = await request.json().catch(() => ({}));
    const { action, teamId, itemKey } = body as {
      action?: string;
      teamId?: string;
      itemKey?: string;
    };

    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    // For session operations we want to allow reading/updating pre-run state, but still block retry after fail/complete.
    const ctx = await requireEscapeRoomTeamContext(request, puzzleId, {
      teamId,
      requireStarted: true,
      requireNotFinished: true,
    });
    if (ctx instanceof NextResponse) return ctx;

    const [progress, user] = await Promise.all([
      (prisma as any).teamEscapeProgress.findUnique({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        select: {
          id: true,
          inventory: true,
          briefingAcks: true,
          inventoryLocks: true,
          runStartedAt: true,
          runExpiresAt: true,
          failedAt: true,
          failedReason: true,
          completedAt: true,
        },
      }),
      prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, name: true, email: true } }),
    ]);

    if (!progress) {
      return NextResponse.json(
        { error: "Escape room has not been started for this team. Start from the team lobby." },
        { status: 409 }
      );
    }
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Leader is the creator of the current lobby (teamId::puzzleId).
    // If the lobby isn't in-memory (e.g., after a restart), fall back to allowing start.
    const lobbyLeaderId = getLobbyLeaderId(ctx.teamId, puzzleId);
    const isLeader = lobbyLeaderId ? lobbyLeaderId === ctx.userId : true;

    if (action === "ackBriefing") {
      const acks = safeJsonParse<BriefingAcksMap>(progress.briefingAcks, {});
      acks[ctx.userId] = nowIso();

      const updated = await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        data: { briefingAcks: JSON.stringify(acks) },
        select: { briefingAcks: true, runStartedAt: true, runExpiresAt: true },
      });

      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        briefingAcks: safeJsonParse(updated.briefingAcks, {}),
        runStartedAt: updated.runStartedAt,
        runExpiresAt: updated.runExpiresAt,
      });

      await emitEscapeActivity(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        entry: {
          id: makeActivityId(),
          ts: new Date().toISOString(),
          type: 'briefing_ack',
          title: 'Acknowledged the briefing',
          actor: { id: user.id, name: user.name || user.email || 'Teammate' },
        },
      });

      return NextResponse.json({ ok: true, briefingAcks: safeJsonParse(updated.briefingAcks, {}) });
    }

    if (action === "startRun") {
      if (!isLeader) return NextResponse.json({ error: "Only the team leader can start the run" }, { status: 403 });
      if (progress.runStartedAt) {
        return NextResponse.json({ ok: true, runStartedAt: progress.runStartedAt, runExpiresAt: progress.runExpiresAt });
      }

      const members = await prisma.teamMember.findMany({
        where: { teamId: ctx.teamId },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m) => m.userId));

      const acks = safeJsonParse<BriefingAcksMap>(progress.briefingAcks, {});
      const ackedCount = Object.keys(acks).filter((uid) => memberIds.has(uid)).length;
      if (ackedCount < members.length) {
        return NextResponse.json({ error: `All players must acknowledge the briefing (${ackedCount}/${members.length})` }, { status: 409 });
      }

      const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
        where: { id: ctx.escapeRoomId },
        select: { timeLimitSeconds: true },
      });

      const limitSeconds = escapeRoom?.timeLimitSeconds ?? 1800;
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + limitSeconds * 1000);

      const updated = await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        data: { runStartedAt: startedAt, runExpiresAt: expiresAt },
        select: { runStartedAt: true, runExpiresAt: true, briefingAcks: true },
      });

      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        briefingAcks: safeJsonParse(updated.briefingAcks, {}),
        runStartedAt: updated.runStartedAt,
        runExpiresAt: updated.runExpiresAt,
      });

      await emitEscapeActivity(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        entry: {
          id: makeActivityId(),
          ts: new Date().toISOString(),
          type: 'run_started',
          title: 'Started the run',
          actor: { id: user.id, name: user.name || user.email || 'Teammate' },
        },
      });

      return NextResponse.json({ ok: true, runStartedAt: updated.runStartedAt, runExpiresAt: updated.runExpiresAt });
    }

    if (action === "acquireLock") {
      if (!itemKey) return NextResponse.json({ error: "itemKey is required" }, { status: 400 });
      if (!progress.runStartedAt) return NextResponse.json({ error: "Run has not started" }, { status: 409 });

      const inventory = safeJsonParse<string[]>(progress.inventory, []);
      if (!inventory.includes(itemKey)) {
        return NextResponse.json({ error: "Item is not in inventory" }, { status: 400 });
      }

      const locks = safeJsonParse<InventoryLocksMap>(progress.inventoryLocks, {});
      const existing = locks[itemKey];

      const now = Date.now();
      const existingExpires = existing?.expiresAt ? Date.parse(existing.expiresAt) : 0;
      const isExpired = !!existing && existing.expiresAt && Number.isFinite(existingExpires) && existingExpires <= now;

      if (existing && existing.lockedBy !== ctx.userId && !isExpired) {
        return NextResponse.json({ error: "Item is locked", lock: existing }, { status: 409 });
      }

      const ttlMs = 2 * 60 * 1000;
      locks[itemKey] = {
        lockedBy: ctx.userId,
        lockedByName: user.name || user.email,
        lockedAt: nowIso(),
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      };

      const updated = await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        data: { inventoryLocks: JSON.stringify(locks) },
        select: { inventoryLocks: true },
      });

      const inventoryLocks = safeJsonParse(updated.inventoryLocks, {});
      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        inventoryLocks,
      });

      await emitEscapeActivity(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        entry: {
          id: makeActivityId(),
          ts: new Date().toISOString(),
          type: 'item_lock',
          title: `Using item: ${itemKey}`,
          actor: { id: user.id, name: user.name || user.email || 'Teammate' },
          meta: { itemKey },
        },
      });

      return NextResponse.json({ ok: true, inventoryLocks });
    }

    if (action === "releaseLock") {
      if (!itemKey) return NextResponse.json({ error: "itemKey is required" }, { status: 400 });

      const locks = safeJsonParse<InventoryLocksMap>(progress.inventoryLocks, {});
      const existing = locks[itemKey];
      if (!existing) return NextResponse.json({ ok: true, inventoryLocks: locks });

      const canRelease = existing.lockedBy === ctx.userId || isLeader;
      if (!canRelease) return NextResponse.json({ error: "Only the lock owner (or leader) can release" }, { status: 403 });

      delete locks[itemKey];

      const updated = await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        data: { inventoryLocks: JSON.stringify(locks) },
        select: { inventoryLocks: true },
      });

      const inventoryLocks = safeJsonParse(updated.inventoryLocks, {});
      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        inventoryLocks,
      });

      return NextResponse.json({ ok: true, inventoryLocks });
    }

    if (action === "releaseLock") {
      if (!itemKey) return NextResponse.json({ error: "itemKey is required" }, { status: 400 });

      const locks = safeJsonParse<InventoryLocksMap>(progress.inventoryLocks, {});
      const existing = locks[itemKey];
      if (!existing) return NextResponse.json({ ok: true, inventoryLocks: locks });

      const canRelease = existing.lockedBy === ctx.userId || isLeader;
      if (!canRelease) return NextResponse.json({ error: "Only the lock owner (or leader) can release" }, { status: 403 });

      delete locks[itemKey];

      const updated = await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        data: { inventoryLocks: JSON.stringify(locks) },
        select: { inventoryLocks: true },
      });

      const inventoryLocks = safeJsonParse(updated.inventoryLocks, {});
      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        inventoryLocks,
      });

      await emitEscapeActivity(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        entry: {
          id: makeActivityId(),
          ts: new Date().toISOString(),
          type: 'item_release',
          title: `Released item: ${itemKey}`,
          actor: { id: user.id, name: user.name || user.email || 'Teammate' },
          meta: { itemKey },
        },
      });

      return NextResponse.json({ ok: true, inventoryLocks });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Escape-room session error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

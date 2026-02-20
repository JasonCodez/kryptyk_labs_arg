import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notification-service';
import { sendEmail, generateTeamLobbyInviteEmail } from '@/lib/mail';
import { deleteLobby, ensureLobby, findActiveLobbyForTeam, getLobby, keyFor } from "@/lib/teamLobbyStore";

async function resetTeamEscapeProgressForPuzzle(teamId: string, puzzleId: string) {
  try {
    const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, include: { escapeRoom: true } });
    if (!puzzle?.escapeRoom?.id) return;
    await (prisma as any).teamEscapeProgress.deleteMany({ where: { teamId, escapeRoomId: puzzle.escapeRoom.id } });
  } catch {
    // ignore
  }
}

async function cleanupPersistentLobbyData(teamId: string, puzzleId: string) {
  try {
    // remove persisted lobby chat messages for this lobby
    await prisma.lobbyMessage.deleteMany({ where: { teamId, puzzleId } });
  } catch (e) {
    console.warn('cleanupPersistentLobbyData: failed to delete lobby messages', e);
  }
  try {
    // remove notifications that reference this lobby (relatedId encodes team::puzzle)
    await prisma.notification.deleteMany({ where: { relatedId: `${teamId}::${puzzleId}` } });
  } catch (e) {
    console.warn('cleanupPersistentLobbyData: failed to delete notifications', e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("teamId");
    const puzzleId = url.searchParams.get("puzzleId");
    if (!teamId || !puzzleId) {
      return NextResponse.json({ error: "teamId and puzzleId required" }, { status: 400 });
    }

    const key = keyFor(teamId, puzzleId);
    const lobby = getLobby(teamId, puzzleId);
    if (!lobby) {
      return NextResponse.json({ teamId, puzzleId, ready: {}, started: false, exists: false });
    }
    return NextResponse.json({ ...lobby, exists: true });
  } catch (err) {
    console.error('lobby GET error', err);
    return NextResponse.json({ error: 'Failed to fetch lobby' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, teamId, puzzleId } = body as { action?: string; teamId?: string; puzzleId?: string };
    if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });
    if (!teamId || !puzzleId) return NextResponse.json({ error: 'teamId and puzzleId required' }, { status: 400 });

    // Socket-server initiated abort (e.g., player disconnect / missing player during escape room).
    // Protected by SOCKET_SECRET so it cannot be triggered by normal clients.
    if (action === 'serverAbort') {
      const provided = (req.headers.get('x-socket-secret') || req.headers.get('X-Socket-Secret') || '') + '';
      const secret = process.env.SOCKET_SECRET || '';
      if (!secret || provided !== secret) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const reason = (body as any)?.reason ? String((body as any).reason) : 'abort';
      const skipEmit = !!(body as any)?.skipEmit;

      // Reset escape-room progress (so the team can restart).
      await resetTeamEscapeProgressForPuzzle(teamId, puzzleId);

      try { await cleanupPersistentLobbyData(teamId, puzzleId); } catch { /* ignore */ }
      deleteLobby(teamId, puzzleId);

      if (!skipEmit) {
        try {
          const { postToSocket } = await import('@/lib/socket-client');
          await postToSocket('/emit', {
            room: keyFor(teamId, puzzleId),
            event: 'lobbyDestroyed',
            payload: { teamId, puzzleId, reason },
          });
          await postToSocket('/emit', {
            room: `escape:${teamId}::${puzzleId}`,
            event: 'escapeAborted',
            payload: { teamId, puzzleId, reason },
          });
        } catch {
          // ignore
        }
      }

      return NextResponse.json({ success: true, destroyed: true, reason });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    console.log(`lobby POST received action=${action} teamId=${teamId} puzzleId=${puzzleId} userEmail=${session.user.email}`);

    const userEmail = session.user.email as string;
    const userRecord = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true, name: true, email: true } });
    if (!userRecord?.id) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = userRecord.id;
    const userName = userRecord.name || userRecord.email || userEmail;
    console.log(`lobby POST resolved userId=${userId}`);

    // For most lobby actions, require the requester to be a member of the team.
    // (declineInvite is allowed even if the user isn't a team member, so they can dismiss notifications.)
    if (action !== 'declineInvite') {
      const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { id: true } });
      if (!membership) {
        return NextResponse.json({ error: 'You must be a member of this team to use the lobby' }, { status: 403 });
      }
    }

    // Escape-room lockout: once a player fails an escape room, they cannot create/join another lobby for it.
    if (action === 'create' || action === 'join') {
      try {
        const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, include: { escapeRoom: true } });
        const escapeRoomId = puzzle?.escapeRoom?.id;
        if (escapeRoomId) {
          const userProgress = await prisma.userEscapeProgress.findUnique({
            where: { userId_escapeRoomId: { userId, escapeRoomId } },
            select: { failedAt: true },
          });
          if (userProgress?.failedAt) {
            return NextResponse.json(
              { error: 'You have already failed this escape room and can no longer join a lobby for it.' },
              { status: 403 }
            );
          }
        }
      } catch {
        // ignore lookup failures
      }
    }

    const key = keyFor(teamId, puzzleId);

    // Leader-only team puzzle switching.
    // If a team already has an active lobby for a different puzzle, block non-leaders
    // from creating/joining a different puzzle lobby (which effectively changes the team puzzle).
    if (action === 'create') {
      const active = findActiveLobbyForTeam(teamId);
      if (active && active.puzzleId !== puzzleId) {
        if (active.started) {
          return NextResponse.json(
            { error: 'A team puzzle is already in progress. Finish it before switching puzzles.', activePuzzleId: active.puzzleId },
            { status: 409 }
          );
        }

        if (active.leaderId && active.leaderId !== userId) {
          return NextResponse.json(
            { error: 'Only the lobby leader can change the team puzzle.', activePuzzleId: active.puzzleId },
            { status: 403 }
          );
        }

        // Leader is switching puzzles: notify clients in the old lobby and clean it up.
        try {
          const { postToSocket } = await import('@/lib/socket-client');
          await postToSocket('/emit', {
            room: keyFor(teamId, active.puzzleId),
            event: 'teamPuzzleChanged',
            payload: { teamId, fromPuzzleId: active.puzzleId, toPuzzleId: puzzleId },
          });
        } catch {
          // ignore
        }

        try { await cleanupPersistentLobbyData(teamId, active.puzzleId); } catch { /* ignore */ }
        deleteLobby(teamId, active.puzzleId);
      }
    }

    // Handle decline without requiring an in-memory lobby.
    // This allows recipients to dismiss notifications even if the lobby was never created
    // (or after a server restart).
    if (action === 'declineInvite') {
      try {
        const lobby = getLobby(teamId, puzzleId);

        // Remove this user's pending invite from in-memory lobby state (best effort)
        try {
          if (lobby?.invites && lobby.invites.length > 0) {
            const before = lobby.invites.length;
            lobby.invites = lobby.invites.filter((inv: any) => !(inv.userId === userId || (inv.email && inv.email === userEmail)));
            const removed = before - lobby.invites.length;
            if (removed > 0) {
              console.log(`declineInvite removed ${removed} invite(s) for user ${userId}`);
            }
          }
        } catch {
          // ignore
        }

        // Update persistent invite record if it exists
        try {
          await prisma.teamInvite.updateMany({ where: { teamId, userId }, data: { status: 'declined' } });
        } catch {
          // ignore
        }

        // Clear the related notification(s) so unread count drops
        try {
          await prisma.notification.deleteMany({ where: { userId, type: 'team_lobby_invite', relatedId: `${teamId}::${puzzleId}` } });
        } catch {
          // ignore
        }

        return NextResponse.json({ success: true, lobby });
      } catch (err) {
        console.error('declineInvite error', err);
        return NextResponse.json({ error: 'Failed to decline invite' }, { status: 500 });
      }
    }

    // Only `create` is allowed to create a brand-new lobby.
    // Other actions must operate on an existing lobby to avoid accidentally changing leader.
    const created = action === 'create' ? ensureLobby(teamId, puzzleId) : null;
    const lobby = created ? created.lobby : getLobby(teamId, puzzleId);
    const lobbyWasNew = created ? created.wasNew : false;

    if (!lobby) {
      // Make leave idempotent: clients often attempt a best-effort leave on unmount/navigation.
      if (action === 'leave') {
        return NextResponse.json({ success: true, left: true, existed: false });
      }

      return NextResponse.json(
        { error: 'Lobby not found. Return to the lobby page to create/join it first.' },
        { status: 409 }
      );
    }

    // allow creating/joining the lobby: add requester as a participant
    if (action === 'create') {
      // The player who creates a brand-new lobby becomes the leader for THIS lobby.
      if (lobbyWasNew) {
        lobby.leaderId = userId;
      }

      if (!lobby.leaderId) {
        lobby.leaderId = userId;
      }
      if (!lobby.participants) lobby.participants = [];
      if (!lobby.participants.includes(userId)) {
        lobby.participants.push(userId);
      }

      // Ensure participants list is unique (protect against concurrent duplicate adds)
      try {
        lobby.participants = Array.from(new Set(lobby.participants));
      } catch (e) {
        // ignore
      }

      // If the joining user had a pending invite, remove it from in-memory invites
      try {
        if (lobby.invites && lobby.invites.length > 0) {
          const before = lobby.invites.length;
          // remove invites matching this user id or email
          lobby.invites = lobby.invites.filter((inv) => !(inv.userId === userId || (inv.email && inv.email === userEmail)));
          const removedCount = before - lobby.invites.length;
          if (removedCount > 0) {
            console.log(`lobby join removed ${removedCount} pending invite(s) for user ${userId}`);
            // clean up persistent invites and notifications for this team/puzzle/user
            try {
              await prisma.teamInvite.deleteMany({ where: { teamId, userId } });
              await prisma.notification.deleteMany({ where: { userId, type: 'team_lobby_invite', relatedId: `${teamId}::${puzzleId}` } });
              console.log('lobby join cleaned persistent teamInvite/notification for', userId);
            } catch (cleanupErr) {
              console.warn('lobby join: failed to clean persistent invite/notifications', cleanupErr);
            }
          }
        }
      } catch (e) {
        console.warn('lobby join: error while checking/removing invites', e);
      }

      return NextResponse.json({ success: true, lobby });
    }

    if (action === 'join') {
      // Join an existing lobby without changing its leader.
      if (!lobby.participants) lobby.participants = [];
      if (!lobby.participants.includes(userId)) {
        lobby.participants.push(userId);
      }

      try {
        lobby.participants = Array.from(new Set(lobby.participants));
      } catch {
        // ignore
      }

      return NextResponse.json({ success: true, lobby });
    }

    if (action === 'ready') {
      // must be a participant to mark ready
      if (!lobby.participants?.includes(userId)) {
        return NextResponse.json({ error: 'You must join the lobby before marking ready' }, { status: 400 });
      }
      lobby.ready[userId] = true;
      return NextResponse.json({ success: true, lobby });
    }

    if (action === 'unready') {
      delete lobby.ready[userId];
      return NextResponse.json({ success: true, lobby });
    }

    if (action === 'kick') {
      // only the lobby leader may remove participants
      try {
        const leaderId = lobby.leaderId;
        if (leaderId && leaderId !== userId) {
          return NextResponse.json({ error: 'Only the lobby leader can remove participants' }, { status: 403 });
        }

        const { targetUserId } = body as any;
        if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });

        if (!lobby.participants || !lobby.participants.includes(targetUserId)) {
          return NextResponse.json({ error: 'Target user is not a participant' }, { status: 400 });
        }

        lobby.participants = lobby.participants.filter((p) => p !== targetUserId);
        if (lobby.ready) delete lobby.ready[targetUserId];

        // If no participants remain, destroy the lobby and clean persistent lobby data
        if (!lobby.participants || lobby.participants.length === 0) {
          try { await cleanupPersistentLobbyData(teamId, puzzleId); } catch (e) { /* ignore */ }
          deleteLobby(teamId, puzzleId);
          return NextResponse.json({ success: true, removed: targetUserId, destroyed: true });
        }

        // notify socket server that a participant was kicked
        (async () => {
        try {
          const { postToSocket } = await import('@/lib/socket-client');
          await postToSocket('/emit', { room: key, event: 'kicked', payload: { teamId, puzzleId, targetUserId } });
        } catch (e) {
          // ignore
        }
        })();

        // Optionally clean up persistent invites/notifications for this user
        try {
          await prisma.teamInvite.deleteMany({ where: { teamId, userId: targetUserId } });
          await prisma.notification.deleteMany({ where: { userId: targetUserId, type: 'team_lobby_invite', relatedId: `${teamId}::${puzzleId}` } });
        } catch (e) {
          console.warn('kick: failed to clean persistent invites/notifications', e);
        }

        return NextResponse.json({ success: true, removed: targetUserId, lobby });
      } catch (err) {
        console.error('lobby kick error', err);
        return NextResponse.json({ error: 'Failed to remove participant' }, { status: 500 });
      }
    }

    if (action === 'leave') {
      // remove requester from participants and ready list
      try {
        if (lobby.participants) {
          lobby.participants = lobby.participants.filter((p) => p !== userId);
        }
        if (lobby.ready) {
          delete lobby.ready[userId];
        }

        // if no participants remain, destroy the lobby and clean persistent lobby data
        if (!lobby.participants || lobby.participants.length === 0) {
          try { await cleanupPersistentLobbyData(teamId, puzzleId); } catch (e) { /* ignore */ }
          deleteLobby(teamId, puzzleId);
          return NextResponse.json({ success: true, destroyed: true });
        }

        // notify remaining clients that a participant left so they can return to lobby
        (async () => {
          try {
            const { postToSocket } = await import('@/lib/socket-client');
            await postToSocket('/emit', { room: key, event: 'participantLeft', payload: { teamId, puzzleId, userId, userName } });
          } catch (e) {
            // ignore
          }
        })();

        return NextResponse.json({ success: true, lobby });
      } catch (e) {
        console.error('lobby leave error', e);
        return NextResponse.json({ error: 'Failed to leave lobby' }, { status: 500 });
      }
    }

    if (action === 'destroy') {
      try {
        // Only the lobby leader may shut down/destroy the lobby.
        const leaderId = lobby.leaderId;
        if (leaderId && leaderId !== userId) {
          return NextResponse.json({ error: 'Only the lobby leader can shut down the lobby' }, { status: 403 });
        }

        // Notify connected clients so they can display a modal and redirect.
        (async () => {
          try {
            const { postToSocket } = await import('@/lib/socket-client');
            await postToSocket('/emit', { room: key, event: 'lobbyDestroyed', payload: { teamId, puzzleId, reason: 'leader_shutdown' } });
          } catch (e) {
            // ignore
          }
        })();
        // Reset escape-room progress as part of destroying the lobby.
        await resetTeamEscapeProgressForPuzzle(teamId, puzzleId);
        try { await cleanupPersistentLobbyData(teamId, puzzleId); } catch (e) { /* ignore */ }
        deleteLobby(teamId, puzzleId);
        return NextResponse.json({ success: true, destroyed: true });
      } catch (e) {
        console.error('lobby destroy error', e);
        return NextResponse.json({ error: 'Failed to destroy lobby' }, { status: 500 });
      }
    }

    if (action === 'reset') {
      // Leader-only: hard reset the lobby (used for restart flows like "not all players reached puzzle page").
      try {
        const leaderId = lobby.leaderId;
        if (leaderId && leaderId !== userId) {
          return NextResponse.json({ error: 'Only the lobby leader can reset the lobby' }, { status: 403 });
        }

        const reason = (body as any)?.reason ? String((body as any).reason) : 'reset';

        try {
          const { postToSocket } = await import('@/lib/socket-client');
          await postToSocket('/emit', { room: key, event: 'lobbyDestroyed', payload: { teamId, puzzleId, reason } });
          await postToSocket('/emit', { room: `escape:${teamId}::${puzzleId}`, event: 'escapeAborted', payload: { teamId, puzzleId, reason } });
        } catch {
          // ignore
        }

        await resetTeamEscapeProgressForPuzzle(teamId, puzzleId);
        try { await cleanupPersistentLobbyData(teamId, puzzleId); } catch { /* ignore */ }
        deleteLobby(teamId, puzzleId);
        return NextResponse.json({ success: true, destroyed: true, reason });
      } catch (e) {
        console.error('lobby reset error', e);
        return NextResponse.json({ error: 'Failed to reset lobby' }, { status: 500 });
      }
    }

    if (action === 'enteredPuzzle') {
      // Marks that this user successfully reached the puzzle page.
      try {
        if (!lobby.participants?.includes(userId)) {
          return NextResponse.json({ error: 'You must be a lobby participant to enter the puzzle' }, { status: 400 });
        }
        lobby.enteredPuzzleAt = lobby.enteredPuzzleAt || {};
        lobby.enteredPuzzleAt[userId] = Date.now();
        return NextResponse.json({ success: true, lobby });
      } catch (e) {
        console.error('enteredPuzzle error', e);
        return NextResponse.json({ error: 'Failed to mark puzzle entry' }, { status: 500 });
      }
    }

    if (action === 'start') {
      // Enforce team size matches puzzle parts (exact match required to start)
      try {
        // only the lobby leader may start the puzzle
        const leaderId = lobby.leaderId;
        if (leaderId && leaderId !== userId) {
          return NextResponse.json({ error: 'Only the lobby leader can start the puzzle' }, { status: 403 });
        }

        // Use lobby participants as the intended players for start validation
        const participants = lobby.participants || [];
        const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, include: { parts: { select: { id: true } }, escapeRoom: true } });
        if (!puzzle) return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });

        // Determine required players.
        // Escape rooms are team-only and always require exactly 4 players.
        let requiredPlayers = (puzzle.parts || []).length || puzzle.minTeamSize || 1;
        if (puzzle.escapeRoom) {
          requiredPlayers = 4;

          const memberCount = await prisma.teamMember.count({ where: { teamId } });
          if (memberCount !== 4) {
            return NextResponse.json({ error: `Escape rooms require exactly 4 team members (team has ${memberCount})` }, { status: 400 });
          }
        }

        // enforce exact match for start
        if (participants.length !== requiredPlayers) {
          return NextResponse.json({ error: `Player count mismatch: puzzle requires exactly ${requiredPlayers} players but lobby has ${participants.length}` }, { status: 400 });
        }

        // require all participants to be marked ready
        const notReady = participants.filter((p) => !(lobby?.ready?.[p]));
        if (notReady.length > 0) {
          return NextResponse.json({ error: `Not all participants are ready: ${notReady.length} not ready` }, { status: 400 });
        }

        // Initialize (or reset) team escape progress for escape room puzzles.
        // IMPORTANT: If a previous run existed, we must clear briefing acks and any old run state.
        if (puzzle.escapeRoom) {
          try {
            await (prisma as any).teamEscapeProgress.upsert({
              where: { teamId_escapeRoomId: { teamId, escapeRoomId: puzzle.escapeRoom.id } },
              create: {
                teamId,
                escapeRoomId: puzzle.escapeRoom.id,
                currentStageIndex: 1,
                solvedStages: '[]',
                inventory: '[]',
                roles: '{}',
                briefingAcks: '{}',
                inventoryLocks: '{}',
                startedAt: new Date(),
                runStartedAt: null,
                runExpiresAt: null,
                failedAt: null,
                failedReason: null,
                completedAt: null,
              },
              update: {
                currentStageIndex: 1,
                solvedStages: '[]',
                inventory: '[]',
                roles: '{}',
                briefingAcks: '{}',
                inventoryLocks: '{}',
                startedAt: new Date(),
                runStartedAt: null,
                runExpiresAt: null,
                failedAt: null,
                failedReason: null,
                completedAt: null,
              },
            });
          } catch (e) {
            console.warn('teamEscapeProgress upsert failed', e);
          }
        }

        // mark started in in-memory lobby
        lobby.started = true;

        // attempt to notify the socket server so connected clients transition immediately
        try {
          const { postToSocket } = await import('@/lib/socket-client');
          const res = await postToSocket('/emit', { room: `${teamId}::${puzzleId}`, event: 'puzzleStarting', payload: { teamId, puzzleId } });
          if (!res || !res.ok) {
            console.warn('lobby start: socket emit failed or returned non-OK', { teamId, puzzleId, status: res?.status });
          }
        } catch (e) {
          console.warn('lobby start: postToSocket threw', e);
        }

        return NextResponse.json({ success: true, lobby });
      } catch (err) {
        console.error('lobby start validation error', err);
        return NextResponse.json({ error: 'Failed to validate start conditions' }, { status: 500 });
      }
    }

    if (action === 'invite') {
      // inviter must be the lobby leader
      try {
        console.log('lobby invite flow started', { teamId, puzzleId, userId });
        const leaderId = lobby.leaderId;
        if (leaderId && leaderId !== userId) {
          return NextResponse.json({ error: 'Only the lobby leader can invite members' }, { status: 403 });
        }

        const { inviteeEmail, inviteeUserId } = body as any;
        console.log('lobby invite payload', { inviteeEmail, inviteeUserId });
        let inviteeId: string | undefined = undefined;
        let inviteeEmailFinal: string | undefined = undefined;
        let inviteeDisplayName: string | undefined = undefined;

        if (inviteeUserId) {
          const u = await prisma.user.findUnique({ where: { id: inviteeUserId }, select: { id: true, email: true, name: true } });
          if (!u) return NextResponse.json({ error: 'Invitee user not found' }, { status: 404 });
          inviteeId = u.id;
          inviteeEmailFinal = u.email || undefined;
          inviteeDisplayName = u.name || undefined;
          console.log(`lobby invite resolved invitee by id -> inviteeId=${inviteeId}`);
        } else if (inviteeEmail) {
          const u = await prisma.user.findUnique({ where: { email: inviteeEmail }, select: { id: true, email: true, name: true } });
          if (u) {
            inviteeId = u.id;
            inviteeDisplayName = u.name || undefined;
          }
          inviteeEmailFinal = inviteeEmail;
          console.log(`lobby invite resolved invitee by email -> inviteeId=${inviteeId} inviteeEmailFinal=${inviteeEmailFinal}`);
        } else {
          return NextResponse.json({ error: 'inviteeEmail or inviteeUserId required' }, { status: 400 });
        }

        // Basic sanity checks for known users
        if (inviteeId && inviteeId === userId) {
          return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
        }
        if (inviteeId && (lobby.participants || []).includes(inviteeId)) {
          return NextResponse.json({ error: 'User is already a participant in this lobby' }, { status: 400 });
        }

        const invite = { id: `${Date.now()}-${Math.random()}`, userId: inviteeId, email: inviteeEmailFinal, displayName: inviteeDisplayName, invitedBy: userId, status: 'pending', createdAt: Date.now() };
        if (!lobby.invites) lobby.invites = [];
        // enforce puzzle constraints if puzzleId available
        try {
          const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, include: { parts: { select: { id: true } }, escapeRoom: true } });
          let requiredPlayers = (puzzle?.parts || []).length || puzzle?.minTeamSize || 1;
          if (puzzle?.escapeRoom) requiredPlayers = 4;
          const participants = lobby.participants || [];
          const pendingInvites = (lobby.invites || []).length;
          if (requiredPlayers > 0 && participants.length + pendingInvites >= requiredPlayers) {
            return NextResponse.json({ error: `Cannot invite: lobby already has ${participants.length} participants and ${pendingInvites} pending invites; puzzle requires ${requiredPlayers} players` }, { status: 400 });
          }
        } catch (e) {
          // ignore puzzle lookup errors; proceed with invite
        }

        lobby.invites.push(invite as any);
        console.log('lobby in-memory invite added', invite);

        let notificationCreated = false;
        let emailSent = false;

        // Optionally create a persistent team invite record and an in-app notification
        if (inviteeId) {
          // Persist (or refresh) a TeamInvite record. This should not gate notifications.
          try {
            console.log(`upserting persistent teamInvite for user ${inviteeId}`);
            await prisma.teamInvite.upsert({
              where: { teamId_userId: { teamId, userId: inviteeId } },
              create: {
                teamId,
                userId: inviteeId,
                invitedBy: userId,
                status: 'pending',
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
              },
              update: {
                invitedBy: userId,
                status: 'pending',
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
              },
            });
          } catch (e) {
            console.error('failed to upsert persistent team invite', e);
          }

          // Always create an in-app notification for the invitee (best effort)
          let notificationId: string | undefined;
          try {
            const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
            const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { title: true } });
            const inviteTitle = `Lobby invite from ${inviter?.name || inviter?.email || 'a teammate'}`;
            const inviteMsg = `You've been invited to join a team lobby for '${puzzle?.title || 'a puzzle'}'. Click Join to go to the lobby.`;
            const notification = await createNotification({ userId: inviteeId, type: 'team_lobby_invite' as any, title: inviteTitle, message: inviteMsg, relatedId: `${teamId}::${puzzleId}` });
            notificationCreated = !!notification;
            notificationId = notification?.id;
            console.log('createNotification returned', { notifId: notificationId });

            // Email (best-effort): ensure preference exists so defaults apply
            try {
              await prisma.notificationPreference.upsert({
                where: { userId: inviteeId },
                create: { userId: inviteeId },
                update: {},
              });
            } catch (e) {
              // ignore
            }

            try {
              const pref = await prisma.notificationPreference.findUnique({ where: { userId: inviteeId } });
              console.log('notification preference for invitee', { pref });
              if (pref?.emailNotificationsEnabled) {
                const inviteeUser = await prisma.user.findUnique({ where: { id: inviteeId }, select: { name: true, email: true } });
                if (inviteeUser?.email) {
                  const inviterUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
                  const joinUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(puzzleId)}`;
                  const html = generateTeamLobbyInviteEmail(
                    inviteeUser.name || inviteeUser.email || 'teammate',
                    inviterUser?.name || inviterUser?.email || 'A teammate',
                    (await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }))?.name || 'your team',
                    (await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { title: true } }))?.title || 'a puzzle',
                    joinUrl
                  );
                  const sent = await sendEmail({ to: inviteeUser.email, subject: inviteTitle, html });
                  emailSent = !!sent;
                  console.log('invite email send result', { to: inviteeUser.email, sent });
                  if (sent && notificationId) {
                    await prisma.notification.update({ where: { id: notificationId }, data: { emailSent: true, emailSentAt: new Date() } });
                  }
                }
              }
            } catch (nerr) {
              console.warn('failed to send lobby invite email', nerr);
            }
          } catch (nerr) {
            console.warn('failed to create lobby invite notification', nerr);
          }
        }

        return NextResponse.json({ success: true, invite, lobby, notificationCreated, emailSent });
      } catch (err) {
        console.error('lobby invite error', err);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
      }
    }

    if (action === 'openPuzzle') {
      // Leader-only: once all 4 participants are present, broadcast that the puzzle is opening.
      try {
        const leaderId = lobby.leaderId;
        if (leaderId && leaderId !== userId) {
          return NextResponse.json({ error: 'Only the lobby leader can open the puzzle' }, { status: 403 });
        }

        const participants = Array.isArray(lobby.participants) ? lobby.participants : [];
        if (participants.length !== 4) {
          return NextResponse.json({ error: 'Exactly 4 participants must be in the lobby before opening the puzzle' }, { status: 400 });
        }

        lobby.started = true;
        lobby.puzzleOpenedAt = Date.now();
        // Reset entry tracking for this run.
        lobby.enteredPuzzleAt = {};

        (async () => {
          try {
            const { postToSocket } = await import('@/lib/socket-client');
            await postToSocket('/emit', { room: key, event: 'puzzleOpened', payload: { teamId, puzzleId } });
          } catch {
            // ignore
          }
        })();

        return NextResponse.json({ success: true, lobby });
      } catch (err) {
        console.error('lobby openPuzzle error', err);
        return NextResponse.json({ error: 'Failed to open puzzle' }, { status: 500 });
      }
    }

    if (action === 'uninvite') {
      // inviter must be the lobby leader
      try {
        const leaderId = lobby.leaderId;
        if (leaderId && leaderId !== userId) {
          return NextResponse.json({ error: 'Only the lobby leader can revoke invites' }, { status: 403 });
        }

        const { inviteId, inviteeUserId, inviteeEmail } = body as any;

        if (!lobby.invites || lobby.invites.length === 0) {
          return NextResponse.json({ error: 'No pending invites to revoke' }, { status: 400 });
        }

        // find matching invite in the in-memory lobby
        let foundIndex = -1;
        if (inviteId) {
          foundIndex = lobby.invites.findIndex((inv: any) => inv.id === inviteId);
        }
        if (foundIndex === -1 && inviteeUserId) {
          foundIndex = lobby.invites.findIndex((inv: any) => inv.userId === inviteeUserId);
        }
        if (foundIndex === -1 && inviteeEmail) {
          foundIndex = lobby.invites.findIndex((inv: any) => inv.email === inviteeEmail);
        }

        if (foundIndex === -1) {
          return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
        }

        const [removed] = lobby.invites.splice(foundIndex, 1);

        // remove persistent teamInvite (if exists) and related notification(s)
        try {
          if (removed?.userId) {
            await prisma.teamInvite.deleteMany({ where: { teamId, userId: removed.userId } });
            await prisma.notification.deleteMany({ where: { userId: removed.userId, type: 'team_lobby_invite', relatedId: `${teamId}::${puzzleId}` } });
          } else if (removed?.email) {
            // try to resolve user by email
            const u = await prisma.user.findUnique({ where: { email: removed.email }, select: { id: true } });
            if (u) {
              await prisma.teamInvite.deleteMany({ where: { teamId, userId: u.id } });
              await prisma.notification.deleteMany({ where: { userId: u.id, type: 'team_lobby_invite', relatedId: `${teamId}::${puzzleId}` } });
            }
          }
        } catch (e) {
          console.warn('Failed to clean up persistent invite/notifications', e);
        }

        return NextResponse.json({ success: true, removed, lobby });
      } catch (err) {
        console.error('lobby uninvite error', err);
        return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('lobby POST error', err);
    return NextResponse.json({ error: 'Failed to update lobby' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get('teamId');
    const puzzleId = url.searchParams.get('puzzleId');
    if (!teamId || !puzzleId) return NextResponse.json({ error: 'teamId and puzzleId required' }, { status: 400 });
    deleteLobby(teamId, puzzleId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('lobby DELETE error', err);
    return NextResponse.json({ error: 'Failed to delete lobby' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notification-service';
import { sendEmail, generateTeamLobbyInviteEmail } from '@/lib/mail';

type LobbyState = {
  teamId: string;
  puzzleId: string;
  ready: Record<string, boolean>; // userId -> ready
  participants?: string[]; // userIds who have joined the lobby
  invites?: Array<{
    id: string;
    userId?: string;
    email?: string;
    invitedBy: string;
    status: string; // pending/accepted/declined
    createdAt: number;
  }>;
  // role assignments for planning: userId -> role name
  assignments?: Record<string, string>;
  started?: boolean;
  createdAt: number;
};

// Simple in-memory lobby store. Not persistent across server restarts.
const lobbies: Map<string, LobbyState> = new Map();

function keyFor(teamId: string, puzzleId: string) {
  return `${teamId}::${puzzleId}`;
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
    const lobby = lobbies.get(key);
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, teamId, puzzleId } = body as { action: string; teamId: string; puzzleId: string };
    console.log(`lobby POST received action=${action} teamId=${teamId} puzzleId=${puzzleId} userEmail=${session.user.email}`);
    if (!teamId || !puzzleId) return NextResponse.json({ error: 'teamId and puzzleId required' }, { status: 400 });

    const userEmail = session.user.email as string;
    const userRecord = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
    const userId = userRecord?.id || userEmail;
    console.log(`lobby POST resolved userId=${userId}`);

    const key = keyFor(teamId, puzzleId);
    let lobby = lobbies.get(key);
    if (!lobby) {
      lobby = { teamId, puzzleId, ready: {}, participants: [], invites: [], started: false, createdAt: Date.now() };
      lobbies.set(key, lobby);
    }

    // allow creating/joining the lobby: add requester as a participant
    if (action === 'create') {
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
      // only admins/moderators may remove participants
      try {
        const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
        if (!membership || !["admin", "moderator"].includes(membership.role)) {
          return NextResponse.json({ error: 'Only team admins/moderators can remove participants' }, { status: 403 });
        }

        const { targetUserId } = body as any;
        if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });

        if (!lobby.participants || !lobby.participants.includes(targetUserId)) {
          return NextResponse.json({ error: 'Target user is not a participant' }, { status: 400 });
        }

        lobby.participants = lobby.participants.filter((p) => p !== targetUserId);
        if (lobby.ready) delete lobby.ready[targetUserId];

        // If no participants remain, destroy the lobby
        if (!lobby.participants || lobby.participants.length === 0) {
          lobbies.delete(key);
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

        // If the leaving user is the team leader, destroy the lobby and notify remaining participants
        try {
          const team = await prisma.team.findUnique({ where: { id: teamId }, select: { createdBy: true } });
          if (team && team.createdBy === userId) {
            // destroy in-memory lobby
            lobbies.delete(key);
            // notify socket server so connected clients can be redirected
            (async () => {
              try {
                const { postToSocket } = await import('@/lib/socket-client');
                await postToSocket('/emit', { room: key, event: 'lobbyDestroyed', payload: { teamId, puzzleId, reason: 'leader_left' } });
              } catch (e) {
                // ignore
              }
            })();

            return NextResponse.json({ success: true, destroyed: true });
          }
        } catch (e) {
          console.warn('leave: failed to check team leader', e);
        }

        // if no participants remain, destroy the lobby
        if (!lobby.participants || lobby.participants.length === 0) {
          lobbies.delete(key);
          return NextResponse.json({ success: true, destroyed: true });
        }

        return NextResponse.json({ success: true, lobby });
      } catch (e) {
        console.error('lobby leave error', e);
        return NextResponse.json({ error: 'Failed to leave lobby' }, { status: 500 });
      }
    }

    if (action === 'destroy') {
      try {
        // only allow admins/moderators to destroy the lobby
        const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
        if (!membership || !["admin", "moderator"].includes(membership.role)) {
          return NextResponse.json({ error: 'Only team admins/moderators can destroy the lobby' }, { status: 403 });
        }
        lobbies.delete(key);
        return NextResponse.json({ success: true, destroyed: true });
      } catch (e) {
        console.error('lobby destroy error', e);
        return NextResponse.json({ error: 'Failed to destroy lobby' }, { status: 500 });
      }
    }

    if (action === 'start') {
      // Enforce team size matches puzzle parts (exact match required to start)
      try {
        // only the team leader (team.createdBy) may start the puzzle
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { createdBy: true } });
        if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        if (team.createdBy !== userId) {
          return NextResponse.json({ error: 'Only the team leader can start the puzzle' }, { status: 403 });
        }

        // Use lobby participants as the intended players for start validation
        const participants = lobby.participants || [];
        const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, include: { parts: { select: { id: true } }, escapeRoom: true } });
        if (!puzzle) return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });

        // Determine required players. For escape rooms, use the escapeRoom minTeamSize (expects exact match).
        let requiredPlayers = (puzzle.parts || []).length || puzzle.minTeamSize || 1;
        if (puzzle.escapeRoom) {
          const er: any = puzzle.escapeRoom;
          requiredPlayers = (typeof er.minTeamSize !== 'undefined' && er.minTeamSize !== null) ? Number(er.minTeamSize) : requiredPlayers;
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

        // initialize team escape progress for escape room puzzles
        if (puzzle.escapeRoom) {
          try {
            await (prisma as any).teamEscapeProgress.create({ data: { teamId, escapeRoomId: puzzle.escapeRoom.id, currentStageIndex: 0 } });
          } catch (e) {
            // if already exists, ignore
            console.warn('teamEscapeProgress create ignored', e);
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
      // inviter must be admin/moderator of the team
      try {
        console.log('lobby invite flow started', { teamId, puzzleId, userId });
        const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
        if (!membership || !["admin", "moderator"].includes(membership.role)) {
          return NextResponse.json({ error: 'Only team admins/moderators can invite members' }, { status: 403 });
        }

        const { inviteeEmail, inviteeUserId } = body as any;
        console.log('lobby invite payload', { inviteeEmail, inviteeUserId });
        let inviteeId: string | undefined = undefined;
        let inviteeEmailFinal: string | undefined = undefined;

        if (inviteeUserId) {
          const u = await prisma.user.findUnique({ where: { id: inviteeUserId }, select: { id: true, email: true } });
          if (!u) return NextResponse.json({ error: 'Invitee user not found' }, { status: 404 });
          inviteeId = u.id;
          inviteeEmailFinal = u.email || undefined;
          console.log(`lobby invite resolved invitee by id -> inviteeId=${inviteeId}`);
        } else if (inviteeEmail) {
          const u = await prisma.user.findUnique({ where: { email: inviteeEmail }, select: { id: true, email: true } });
          if (u) inviteeId = u.id;
          inviteeEmailFinal = inviteeEmail;
          console.log(`lobby invite resolved invitee by email -> inviteeId=${inviteeId} inviteeEmailFinal=${inviteeEmailFinal}`);
        } else {
          return NextResponse.json({ error: 'inviteeEmail or inviteeUserId required' }, { status: 400 });
        }

        const invite = { id: `${Date.now()}-${Math.random()}`, userId: inviteeId, email: inviteeEmailFinal, invitedBy: userId, status: 'pending', createdAt: Date.now() };
        if (!lobby.invites) lobby.invites = [];
        // enforce puzzle constraints if puzzleId available
        try {
          const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, include: { parts: { select: { id: true } } } });
          const requiredPlayers = (puzzle?.parts || []).length;
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

        // Optionally create a persistent team invite record and an in-app notification
        try {
          if (inviteeId) {
            console.log(`creating persistent teamInvite for user ${inviteeId}`);
            await prisma.teamInvite.create({ data: { teamId, userId: inviteeId, invitedBy: userId, status: 'pending', expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) } });

            // Create an in-app notification for the invitee with a join link encoded in relatedId
            try {
              const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
              const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { title: true } });
              const inviteTitle = `Lobby invite from ${inviter?.name || inviter?.email || 'a teammate'}`;
              const inviteMsg = `You've been invited to join a team lobby for '${puzzle?.title || 'a puzzle'}'. Click Join to go to the lobby.`;
              const notification = await createNotification({ userId: inviteeId, type: 'team_lobby_invite' as any, title: inviteTitle, message: inviteMsg, relatedId: `${teamId}::${puzzleId}` });
              console.log('createNotification returned', { notifId: notification?.id });
              // Attempt to send an email if the user has email notifications enabled
              try {
                const pref = await prisma.notificationPreference.findUnique({ where: { userId: inviteeId } });
                console.log('notification preference for invitee', { pref });
                if (pref?.emailNotificationsEnabled) {
                  const inviteeUser = await prisma.user.findUnique({ where: { id: inviteeId }, select: { name: true, email: true } });
                  if (inviteeUser?.email) {
                    const inviterUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
                    const joinUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(puzzleId)}`;
                    const html = generateTeamLobbyInviteEmail(inviteeUser.name || inviteeUser.email || 'teammate', inviterUser?.name || inviterUser?.email || 'A teammate', (await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }))?.name || 'your team', (await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { title: true } }))?.title || 'a puzzle', joinUrl);
                    const sent = await sendEmail({ to: inviteeUser.email, subject: inviteTitle, html });
                    console.log('invite email send result', { to: inviteeUser.email, sent });
                    if (sent && notification) {
                      await prisma.notification.update({ where: { id: notification.id }, data: { emailSent: true, emailSentAt: new Date() } });
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
        } catch (e) {
          // ignore DB invite creation errors for invite flow; keep in-memory invite
          console.error('failed to create persistent team invite', e);
        }

        return NextResponse.json({ success: true, invite, lobby });
      } catch (err) {
        console.error('lobby invite error', err);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
      }
    }

    if (action === 'assignRoles') {
      // allow admins/moderators to assign roles for planning
      try {
        const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
        if (!membership || !["admin", "moderator"].includes(membership.role)) {
          return NextResponse.json({ error: 'Only team admins/moderators can assign roles' }, { status: 403 });
        }

        const { assignments } = body as any; // { userId: role }
        if (!assignments || typeof assignments !== 'object') {
          return NextResponse.json({ error: 'assignments object required' }, { status: 400 });
        }

        // Persist in in-memory lobby state so other clients can poll it
        if (!lobby) {
          lobby = { teamId, puzzleId, ready: {}, participants: [], invites: [], started: false, createdAt: Date.now() };
          lobbies.set(key, lobby);
        }
        lobby.assignments = lobby.assignments || {};
        // Validate uniqueness: no two users may have the same non-empty role
        try {
          const assignedRoles = Object.values(assignments || {}).filter((r: any) => !!r);
          const uniqueRoles = new Set(assignedRoles);
          if (uniqueRoles.size !== assignedRoles.length) {
            return NextResponse.json({ error: 'Each role must be unique; duplicate role assignments detected' }, { status: 400 });
          }
        } catch (e) {
          // ignore validation failure path and let later code handle it
        }

        for (const uid of Object.keys(assignments)) {
          const role = assignments[uid];
          if (typeof role === 'string') lobby.assignments[uid] = role;
        }

        // notify connected clients via socket server that roles have been assigned
        (async () => {
        try {
          const { postToSocket } = await import('@/lib/socket-client');
          await postToSocket('/emit', { room: key, event: 'rolesAssigned', payload: { teamId, puzzleId, assignments: lobby.assignments } });
        } catch (e) {
          // ignore
        }
        })();

        return NextResponse.json({ success: true, lobby });
      } catch (err) {
        console.error('lobby assignRoles error', err);
        return NextResponse.json({ error: 'Failed to assign roles' }, { status: 500 });
      }
    }

    if (action === 'uninvite') {
      // inviter must be admin/moderator of the team
      try {
        const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
        if (!membership || !["admin", "moderator"].includes(membership.role)) {
          return NextResponse.json({ error: 'Only team admins/moderators can revoke invites' }, { status: 403 });
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
    const key = keyFor(teamId, puzzleId);
    lobbies.delete(key);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('lobby DELETE error', err);
    return NextResponse.json({ error: 'Failed to delete lobby' }, { status: 500 });
  }
}

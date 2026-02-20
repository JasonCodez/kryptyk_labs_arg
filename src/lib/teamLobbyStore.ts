export type LobbyState = {
  teamId: string;
  puzzleId: string;
  ready: Record<string, boolean>; // userId -> ready
  participants?: string[]; // userIds who have joined the lobby
  leaderId?: string; // userId of the player who created the lobby
  invites?: Array<{
    id: string;
    userId?: string;
    email?: string;
    invitedBy: string;
    status: string; // pending/accepted/declined
    createdAt: number;
  }>;
  started?: boolean;
  // When set, the leader has opened the puzzle and clients should navigate to the puzzle page.
  puzzleOpenedAt?: number;
  // When set, tracks which users have actually reached the puzzle page in this run.
  // userId -> epoch ms when they entered.
  enteredPuzzleAt?: Record<string, number>;
  createdAt: number;
};

// Simple in-memory lobby store. Not persistent across server restarts.
const lobbies: Map<string, LobbyState> = new Map();

export function keyFor(teamId: string, puzzleId: string) {
  return `${teamId}::${puzzleId}`;
}

export function getLobby(teamId: string, puzzleId: string) {
  return lobbies.get(keyFor(teamId, puzzleId));
}

export function ensureLobby(teamId: string, puzzleId: string) {
  const key = keyFor(teamId, puzzleId);
  let lobby = lobbies.get(key);
  const wasNew = !lobby;
  if (!lobby) {
    lobby = { teamId, puzzleId, ready: {}, participants: [], invites: [], started: false, enteredPuzzleAt: {}, createdAt: Date.now() };
    lobbies.set(key, lobby);
  }
  return { lobby, wasNew };
}

export function deleteLobby(teamId: string, puzzleId: string) {
  lobbies.delete(keyFor(teamId, puzzleId));
}

export function getLobbyLeaderId(teamId: string, puzzleId: string) {
  return getLobby(teamId, puzzleId)?.leaderId ?? null;
}

export function findActiveLobbyForTeam(teamId: string) {
  // A team is considered to have an "active" lobby if any lobby for the team
  // currently has at least one participant.
  for (const lobby of lobbies.values()) {
    if (lobby.teamId !== teamId) continue;
    if ((lobby.participants?.length || 0) > 0) return lobby;
  }
  return null;
}

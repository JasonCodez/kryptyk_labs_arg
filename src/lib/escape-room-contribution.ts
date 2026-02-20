type ContributionGateConfig = {
  enabled?: boolean;
  requiredDistinct?: number;
  minActionsPerPlayer?: number;
};

type SceneStateLike = {
  stageContributions?: Record<string, Record<string, number>>;
};

export type StageContributionSummary = {
  enabled: boolean;
  stageIndex: number;
  requiredDistinct: number;
  minActionsPerPlayer: number;
  distinctContributors: number;
  allPlayersMetMinimum: boolean;
  byUser: Record<string, number>;
  missingUserIds: string[];
};

function normalizeStageContributions(raw: unknown): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Record<string, number>> = {};
  for (const [stageKey, userMapRaw] of Object.entries(raw as Record<string, unknown>)) {
    if (!stageKey || typeof userMapRaw !== 'object' || !userMapRaw) continue;
    const userOut: Record<string, number> = {};
    for (const [userId, countRaw] of Object.entries(userMapRaw as Record<string, unknown>)) {
      const n = Number(countRaw);
      if (typeof userId !== 'string' || !userId.trim()) continue;
      if (!Number.isFinite(n) || n <= 0) continue;
      userOut[userId] = Math.floor(n);
    }
    if (Object.keys(userOut).length > 0) out[stageKey] = userOut;
  }
  return out;
}

export function recordStageContribution(input: {
  sceneStateRaw: unknown;
  stageIndex: number;
  userId: string;
  incrementBy?: number;
}): Record<string, unknown> {
  const base = (input.sceneStateRaw && typeof input.sceneStateRaw === 'object') ? (input.sceneStateRaw as Record<string, unknown>) : {};
  const stageContributions = normalizeStageContributions(base.stageContributions);
  const stageKey = String(Math.max(1, Math.floor(input.stageIndex || 1)));
  const userId = String(input.userId || '').trim();
  if (!userId) return { ...base, stageContributions };

  const deltaRaw = Number(input.incrementBy ?? 1);
  const delta = Number.isFinite(deltaRaw) && deltaRaw > 0 ? Math.floor(deltaRaw) : 1;

  const stageMap = { ...(stageContributions[stageKey] || {}) };
  stageMap[userId] = Math.max(0, Math.floor(stageMap[userId] || 0)) + delta;
  stageContributions[stageKey] = stageMap;

  return {
    ...base,
    stageContributions,
  };
}

export function parseContributionGate(meta: unknown, defaults: { requiredDistinct: number; minActionsPerPlayer: number }): ContributionGateConfig {
  const gateRaw = (meta && typeof meta === 'object' && (meta as any).contributionGate && typeof (meta as any).contributionGate === 'object')
    ? ((meta as any).contributionGate as Record<string, unknown>)
    : null;

  if (!gateRaw) {
    return {
      enabled: true,
      requiredDistinct: defaults.requiredDistinct,
      minActionsPerPlayer: defaults.minActionsPerPlayer,
    };
  }

  const requiredDistinctRaw = Number(gateRaw.requiredDistinct);
  const minActionsRaw = Number(gateRaw.minActionsPerPlayer);

  return {
    enabled: gateRaw.enabled === false ? false : true,
    requiredDistinct: Number.isFinite(requiredDistinctRaw) && requiredDistinctRaw >= 0
      ? Math.floor(requiredDistinctRaw)
      : defaults.requiredDistinct,
    minActionsPerPlayer: Number.isFinite(minActionsRaw) && minActionsRaw >= 0
      ? Math.floor(minActionsRaw)
      : defaults.minActionsPerPlayer,
  };
}

export function summarizeStageContributions(input: {
  sceneStateRaw: unknown;
  stageIndex: number;
  teamUserIds: string[];
  gate: ContributionGateConfig;
}): StageContributionSummary {
  const base = (input.sceneStateRaw && typeof input.sceneStateRaw === 'object') ? (input.sceneStateRaw as SceneStateLike) : {};
  const stageContributions = normalizeStageContributions(base.stageContributions);
  const stageKey = String(Math.max(1, Math.floor(input.stageIndex || 1)));
  const byUser = { ...(stageContributions[stageKey] || {}) };

  const teamUserIds = Array.from(new Set((input.teamUserIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const minActionsPerPlayer = Math.max(0, Math.floor(Number(input.gate.minActionsPerPlayer ?? 1)));
  const requiredDistinct = Math.max(0, Math.floor(Number(input.gate.requiredDistinct ?? teamUserIds.length)));

  const distinctContributors = Object.values(byUser).filter((n) => Number(n) > 0).length;
  const missingUserIds = teamUserIds.filter((uid) => (byUser[uid] || 0) < minActionsPerPlayer);
  const allPlayersMetMinimum = missingUserIds.length === 0;

  return {
    enabled: input.gate.enabled !== false,
    stageIndex: Math.max(1, Math.floor(input.stageIndex || 1)),
    requiredDistinct,
    minActionsPerPlayer,
    distinctContributors,
    allPlayersMetMinimum,
    byUser,
    missingUserIds,
  };
}

export function isContributionGateSatisfied(summary: StageContributionSummary): boolean {
  if (!summary.enabled) return true;
  if (summary.distinctContributors < summary.requiredDistinct) return false;
  if (!summary.allPlayersMetMinimum) return false;
  return true;
}

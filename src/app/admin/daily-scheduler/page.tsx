'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface PuzzleOption {
  id: string;
  title: string;
  isActive: boolean;
}

interface TypeRow {
  puzzleType: string;
  label: string;
  puzzles: PuzzleOption[];
  slots: Record<number, string | null>;
}

interface DayColumn {
  dayNumber: number;
  date: string;
}

interface SchedulerResponse {
  startDay: number;
  days: DayColumn[];
  types: TypeRow[];
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function DailySchedulerPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SchedulerResponse | null>(null);
  const [grid, setGrid] = useState<Record<string, string | null>>({});
  const [startDay, setStartDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetConfirming, setResetConfirming] = useState(false);

  const fetchWeek = useCallback(async (day?: number) => {
    setLoading(true);
    setResetConfirming(false);
    try {
      const url = day ? `/api/admin/daily-scheduler?startDay=${day}` : '/api/admin/daily-scheduler';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load scheduler data');
      const json: SchedulerResponse = await res.json();
      setData(json);
      setStartDay(json.startDay);
      const nextGrid: Record<string, string | null> = {};
      for (const type of json.types) {
        for (const d of json.days) {
          nextGrid[`${type.puzzleType}:${d.dayNumber}`] = type.slots[d.dayNumber] ?? null;
        }
      }
      setGrid(nextGrid);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (status === 'unauthenticated') {
        redirect('/auth/signin');
      }
      if (status === 'authenticated' && session?.user?.email) {
        try {
          const response = await fetch('/api/admin/check');
          const result = await response.json();
          setIsAdmin(result.isAdmin);
          if (result.isAdmin) {
            await fetchWeek();
            return;
          }
        } catch (error) {
          console.error('Failed to verify admin:', error);
        }
      }
      setLoading(false);
    };
    if (status !== 'loading') checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  useEffect(() => {
    if (!message) return undefined;
    const id = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(id);
  }, [message]);

  const dirty = useMemo(() => {
    if (!data) return false;
    for (const type of data.types) {
      for (const d of data.days) {
        const key = `${type.puzzleType}:${d.dayNumber}`;
        if ((grid[key] ?? null) !== (type.slots[d.dayNumber] ?? null)) return true;
      }
    }
    return false;
  }, [data, grid]);

  // Clears every cell in the on-screen grid to "— Unassigned —" so the admin can build a
  // fresh 7-day schedule from a blank slate. This only changes local state — nothing is
  // actually removed for players until "Save Week" is clicked, same as any other edit here.
  const handleResetWeek = () => {
    if (!data) return;
    const cleared: Record<string, string | null> = {};
    for (const type of data.types) {
      for (const d of data.days) {
        cleared[`${type.puzzleType}:${d.dayNumber}`] = null;
      }
    }
    setGrid(cleared);
    setResetConfirming(false);
    setMessage({ type: 'success', text: 'Week cleared — assign new puzzles below, then Save Week to apply.' });
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const assignments = data.types.flatMap((type) =>
        data.days.map((d) => ({
          puzzleType: type.puzzleType,
          dayNumber: d.dayNumber,
          puzzleId: grid[`${type.puzzleType}:${d.dayNumber}`] ?? null,
        }))
      );
      const res = await fetch('/api/admin/daily-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save week');
      }
      setMessage({ type: 'success', text: 'Week saved!' });
      await fetchWeek(startDay ?? undefined);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size={180} />;
  }

  if (!isAdmin) {
    return (
      <main style={{ backgroundColor: '#020202' }} className="min-h-screen p-8">
        <div className="text-center text-red-400">Access Denied - Admin Only</div>
      </main>
    );
  }

  return (
    <main style={{ backgroundColor: '#020202' }} className="min-h-screen pt-32 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">📅 Daily Puzzle Scheduler</h1>
              <p style={{ color: '#DDDBF1' }}>
                Plan a full week of dailies at once — streaks cap and reset every 7 days, so schedule ahead in one pass.
              </p>
            </div>
            <Link
              href="/admin/puzzles"
              className="px-4 py-2 rounded text-white transition hover:opacity-90"
              style={{ backgroundColor: '#3891A6' }}
            >
              ← Back to Puzzles
            </Link>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/30 border border-green-600 text-green-200'
                : 'bg-red-900/30 border border-red-600 text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => fetchWeek(Math.max(1, (startDay ?? data.startDay) - 7))}
                className="px-3 py-2 rounded-lg bg-slate-700/60 border border-slate-600 text-gray-200 hover:border-slate-500"
              >
                ← Previous week
              </button>
              <span className="text-gray-300 text-sm">
                Days {data.days[0].dayNumber}–{data.days[data.days.length - 1].dayNumber}
              </span>
              <button
                type="button"
                onClick={() => fetchWeek((startDay ?? data.startDay) + 7)}
                className="px-3 py-2 rounded-lg bg-slate-700/60 border border-slate-600 text-gray-200 hover:border-slate-500"
              >
                Next week →
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-3 bg-slate-800 text-gray-300 sticky left-0 z-10">Type</th>
                    {data.days.map((d) => (
                      <th key={d.dayNumber} className="p-3 bg-slate-800 text-gray-300 text-left min-w-[160px]">
                        Day {d.dayNumber}
                        <div className="text-xs font-normal text-gray-500">{formatDate(d.date)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.types.map((type) => (
                    <tr key={type.puzzleType} className="border-t border-slate-700">
                      <td className="p-3 bg-slate-800/60 text-white font-semibold sticky left-0 z-10">
                        {type.label}
                      </td>
                      {data.days.map((d) => {
                        const key = `${type.puzzleType}:${d.dayNumber}`;
                        const value = grid[key] ?? '';
                        return (
                          <td key={key} className="p-2 bg-slate-900/40 align-top">
                            <select
                              value={value}
                              onChange={(e) =>
                                setGrid((prev) => ({ ...prev, [key]: e.target.value || null }))
                              }
                              className="w-full px-2 py-2 rounded bg-slate-700/60 border border-slate-600 text-white text-xs"
                            >
                              <option value="">— Unassigned —</option>
                              {type.puzzles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.title}
                                  {!p.isActive && p.id !== (type.slots[d.dayNumber] ?? '') ? ' (already daily elsewhere)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={handleSave}
                className="px-6 py-3 rounded-lg font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#3891A6' }}
              >
                {saving ? 'Saving…' : 'Save Week'}
              </button>

              {resetConfirming ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="text-red-300">Clear all 7 days? This won&apos;t save until you click Save Week.</span>
                  <button
                    type="button"
                    onClick={handleResetWeek}
                    className="px-3 py-1.5 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                  >
                    Yes, clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirming(false)}
                    className="px-3 py-1.5 rounded text-xs bg-slate-600 hover:bg-slate-500 text-gray-300"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setResetConfirming(true)}
                  className="px-4 py-3 rounded-lg font-semibold text-red-300 border border-red-500/40 hover:bg-red-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reset Week
                </button>
              )}

              {dirty && !saving && !resetConfirming && (
                <span className="text-xs text-amber-300">You have unsaved changes</span>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

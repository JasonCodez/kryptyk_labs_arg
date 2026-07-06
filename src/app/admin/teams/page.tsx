"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";

interface AdminTeam {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  createdBy: string;
  _count: { members: number };
}

export default function AdminTeamsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [fetchingTeams, setFetchingTeams] = useState(false);
  const [filterName, setFilterName] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (session?.user?.email) {
      checkAdminStatus();
    }
  }, [session, status]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/admin/check");
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.isAdmin);
        if (data.isAdmin) fetchTeams();
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    setFetchingTeams(true);
    try {
      const res = await fetch("/api/admin/teams");
      if (res.ok) setTeams(await res.json());
    } catch (e) {
      console.error("Failed to fetch team list", e);
    } finally {
      setFetchingTeams(false);
    }
  };

  const startDeleteConfirm = (id: string) => {
    setDeleteConfirmId(id);
    setConfirmNameInput("");
    setDeleteError(null);
  };

  const cancelDeleteConfirm = () => {
    setDeleteConfirmId(null);
    setConfirmNameInput("");
  };

  const handleDeleteTeam = async (team: AdminTeam) => {
    setDeletingId(team.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmNameInput }),
      });
      if (res.ok) {
        setTeams((prev) => prev.filter((t) => t.id !== team.id));
        setDeleteConfirmId(null);
        setConfirmNameInput("");
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Delete failed");
      }
    } catch (e) {
      setDeleteError("Network error — could not delete team");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || loading) {
    return <LoadingSpinner size={180} />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">❌ Access Denied</h1>
          <p style={{ color: '#DDDBF1' }} className="mb-6">You don&apos;t have permission to access the admin panel.</p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 text-white font-semibold rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: '#3891A6' }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const filteredTeams = teams.filter((t) =>
    !filterName || t.name.toLowerCase().includes(filterName.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      <div className="pt-24">
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <Link href="/admin/puzzles" className="text-sm text-sky-400 hover:underline">← Back to Admin</Link>

          <div className="flex items-center justify-between mt-4 mb-2">
            <h1 className="text-4xl font-bold text-white">👥 Manage Teams</h1>
            <button
              type="button"
              onClick={fetchTeams}
              disabled={fetchingTeams}
              className="px-3 py-1.5 rounded text-sm bg-slate-700 text-gray-300 hover:bg-slate-600 border border-slate-600 disabled:opacity-50"
            >
              {fetchingTeams ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
          <p className="text-[#9BD1D6] mb-8">
            View every team and, if necessary, permanently delete one — this removes its members, chat, and progress.
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Search by team name…"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-gray-500 text-sm"
            />
          </div>

          {deleteError && (
            <div className="mb-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between">
              <span>⚠ {deleteError}</span>
              <button type="button" onClick={() => setDeleteError(null)} className="ml-4 text-red-400 hover:text-white">✕</button>
            </div>
          )}

          {fetchingTeams ? (
            <p className="text-gray-400 text-sm">Loading teams…</p>
          ) : teams.length === 0 ? (
            <p className="text-gray-500 text-sm">No teams exist yet.</p>
          ) : filteredTeams.length === 0 ? (
            <p className="text-gray-500 text-sm">No teams match your search.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">{filteredTeams.length} of {teams.length} teams</p>
              <div className="overflow-auto rounded-lg border border-slate-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-gray-400 uppercase text-xs tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Members</th>
                      <th className="px-4 py-3 font-semibold">Visibility</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-white font-medium">
                          {team.name}
                          {team.description && (
                            <p className="text-xs text-gray-500 font-normal mt-0.5 max-w-xs truncate">{team.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{team._count.members}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${team.isPublic ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>
                            {team.isPublic ? 'Public' : 'Private'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(team.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {deleteConfirmId === team.id ? (
                            <span className="inline-flex items-center gap-2 justify-end">
                              <span className="text-red-300 text-xs">
                                Type "<strong>{team.name}</strong>" to confirm:
                              </span>
                              <input
                                type="text"
                                value={confirmNameInput}
                                onChange={(e) => setConfirmNameInput(e.target.value)}
                                className="px-2 py-1 rounded text-xs bg-slate-900 border border-red-500/40 text-white w-36"
                                placeholder={team.name}
                              />
                              <button
                                type="button"
                                disabled={deletingId === team.id || confirmNameInput !== team.name}
                                onClick={() => handleDeleteTeam(team)}
                                className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {deletingId === team.id ? "Deleting…" : "Yes, delete"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelDeleteConfirm}
                                className="px-2 py-1 rounded text-xs bg-slate-600 hover:bg-slate-500 text-gray-300"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startDeleteConfirm(team.id)}
                              className="px-3 py-1 rounded text-xs border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors"
                            >
                              Delete Team
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

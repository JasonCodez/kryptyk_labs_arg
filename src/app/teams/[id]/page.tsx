"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import InviteTeamModal from "@/components/teams/InviteTeamModal";
import ActionModal from "@/components/ActionModal";
import ConfirmModal from "@/components/ConfirmModal";

interface TeamMember {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  role: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  members: TeamMember[];
  createdAt: string;
}

interface TeamProgress {
  puzzleId: string;
  solved: boolean;
  pointsEarned: number;
}

export default function TeamDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);
  const [modalVariant, setModalVariant] = useState<"success" | "error" | "info">("info");
  const [inviteStatus, setInviteStatus] = useState<'none' | 'pending' | 'accepted' | 'declined'>('none');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMember, setConfirmMember] = useState<TeamMember | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  useEffect(() => {
    // Allow public viewing; fetch team data regardless of auth status.
    const fetchTeam = async () => {
      try {
        const response = await fetch(`/api/teams/${teamId}`);
        if (!response.ok) throw new Error("Failed to fetch team");
        const data = await response.json();
        setTeam(data);

        // If signed-in, ask server for membership/role to avoid relying on client-side member email fields.
        if (session?.user?.email) {
          try {
            const m = await fetch(`/api/teams/${teamId}/membership`);
            if (m.ok) {
              const jr = await m.json();
              setUserRole(jr.role);
            }
            // fetch invite status for current user
            try {
              const s = await fetch(`/api/teams/${teamId}/invite-status`);
              if (s.ok) {
                const js = await s.json();
                setInviteStatus(js.status === 'declined' ? 'none' : (js.status ?? 'none'));
              }
            } catch (ie) {
              console.error('Failed to fetch invite status', ie);
            }
          } catch (e) {
            console.error('Failed to fetch membership role', e);
          }
        }
      } catch (err) {
        setError("Failed to load team");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (teamId) fetchTeam();
  }, [teamId, status, router]);

  useEffect(() => {
    // If user is admin/moderator, fetch pending applications
    if (userRole && ["admin", "moderator"].includes(userRole) && teamId) {
      (async () => {
        try {
          const res = await fetch(`/api/teams/${teamId}/applications`);
          if (!res.ok) throw new Error("Failed to fetch applications");
          const data = await res.json();
          setApplications(data || []);
        } catch (err) {
          console.error("Failed to load applications:", err);
        }
      })();
    }
  }, [userRole, teamId]);

  // Poll membership role periodically so a promoted member sees the role update without a hard refresh.
  useEffect(() => {
    if (!teamId || !session?.user?.email) return;

    let timer: any = null;
    const poll = async () => {
      try {
        const m = await fetch(`/api/teams/${teamId}/membership`);
        if (!m.ok) return;
        const js = await m.json();
        const newRole = js.role ?? null;
        if (newRole !== userRole) {
          setUserRole(newRole);
          // If promoted to admin, refresh full team details so UI updates
          if (newRole === 'admin') {
            const t = await fetch(`/api/teams/${teamId}`);
            if (t.ok) setTeam(await t.json());
          }
        }
      } catch (e) {
        // ignore
      }
    };

    // Run immediately and then every 10s
    poll();
    timer = setInterval(poll, 10000);
    return () => { if (timer) clearInterval(timer); };
  }, [teamId, session?.user?.email, userRole]);

  // Poll invite status while pending so UI updates if admin responds
  useEffect(() => {
    if (!teamId) return;
    let timer: any = null;
    const check = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/invite-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status && data.status !== inviteStatus) {
          // if declined, allow re-apply by returning to 'none'
          const newStatus = data.status === 'declined' ? 'none' : data.status;
          setInviteStatus(newStatus);
          // if accepted, refresh team and membership
          if (data.status === 'accepted') {
            const t = await fetch(`/api/teams/${teamId}`);
            if (t.ok) setTeam(await t.json());
            const m = await fetch(`/api/teams/${teamId}/membership`);
            if (m.ok) setUserRole((await m.json()).role);
          }
        }
      } catch (err) {
        // ignore
      }
    };

    if (inviteStatus === 'pending') {
      timer = setInterval(check, 5000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [inviteStatus, teamId]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div style={{ color: '#FDE74C' }} className="text-lg">Loading team...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div style={{ color: '#AB9F9D' }} className="text-lg">Team not found</div>
      </div>
    );
  }

  const totalPoints = team.members.reduce((sum, member) => {
    // This would need progress data - for now just show member count
    return sum;
  }, 0);

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      {/* Header with Logo */}
      <nav className="backdrop-blur-md" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', backgroundColor: 'rgba(76, 91, 92, 0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/teams" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
        </div>
      </nav>
      
      <div className="p-8">
      <div className="max-w-4xl mx-auto">

        {error && (
          <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
            {error}
          </div>
        )}

        <div className="bg-slate-800/50 border border-teal-500/30 rounded-lg p-8 mb-8">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  {team.name}
                </h1>
                {team.description && (
                  <p className="text-teal-200">{team.description}</p>
                )}
              </div>
              {team.isPublic && (
                <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-300">
                  Public
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Members</p>
                <p className="text-2xl font-bold text-white">
                  {team.members.length}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Created</p>
                <p className="text-sm text-white">
                  {new Date(team.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1">Team Invite</p>
                <code className="text-xs text-teal-300 font-mono">
                  {teamId.substring(0, 8)}
                </code>
              </div>
            </div>
          </div>

          <div className="border-t border-teal-500/30 pt-8">
            <h2 className="text-2xl font-bold text-white mb-6">Members</h2>
            <div className="space-y-3">
              {team.members.map((member) => (
                <div
                  key={member.user.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-teal-500/30"
                >
                  <div className="flex items-center gap-4">
                    {member.user.image ? (
                      <img
                        src={member.user.image}
                        alt={member.user.name || "Member"}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-300">
                        👤
                      </div>
                    )}

                    <div>
                      <p className="text-white font-semibold">
                        <Link href={`/profile/${member.user.id}`} className="hover:underline">
                          {member.user.name || "Member"}
                        </Link>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        member.role === "admin"
                          ? "bg-teal-500/20 text-teal-300"
                          : "bg-slate-600/20 text-slate-300"
                      }`}
                    >
                      {member.role === "admin" ? "👑 Admin" : "Member"}
                    </span>

                    {/* Kick button for admins/moderators (can't kick yourself) */}
                    {userRole && ["admin", "moderator"].includes(userRole) && session?.user?.email !== member.user.email && (
                      <button
                        onClick={() => {
                          setConfirmMember(member);
                          setConfirmOpen(true);
                        }}
                        className="px-3 py-1 rounded bg-red-600 text-white text-sm"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending applications for admins/mods */}
          {userRole && ["admin", "moderator"].includes(userRole) && (
            <div id="applications" className="border-t border-teal-500/30 pt-8 mt-8">
              <h2 className="text-2xl font-bold text-white mb-6">Pending Applications</h2>
              {applications.length === 0 ? (
                <p className="text-sm text-teal-200">No pending applications.</p>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-teal-500/30">
                      <div className="flex items-center gap-4">
                        {app.user?.image ? (
                          <img src={app.user.image} alt={app.user.name || 'Applicant'} className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-300">👤</div>
                        )}
                        <div>
                          <p className="text-white font-semibold">{app.user?.name || app.user?.email || 'Applicant'}</p>
                          <p className="text-xs text-teal-200">Applied {new Date(app.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                                  const res = await fetch(`/api/teams/${teamId}/applications/${app.id}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'approve' }),
                                  });
                                  if (!res.ok) {
                                    const txt = await res.text();
                                    throw new Error(txt || 'Failed to approve applicant');
                                  }
                                  setApplications((prev) => prev.filter(a => a.id !== app.id));
                                  // Optionally refresh team members
                                  const t = await fetch(`/api/teams/${teamId}`);
                                  if (t.ok) setTeam(await t.json());
                                  setModalTitle('Applicant approved');
                                  setModalMessage('The applicant has been added to the team.');
                                  setModalVariant('success');
                                  setModalOpen(true);
                                } catch (err) {
                                  console.error(err);
                                  setModalTitle('Approve failed');
                                  setModalMessage((err as any)?.message || 'Failed to approve applicant');
                                  setModalVariant('error');
                                  setModalOpen(true);
                                }
                          }}
                          className="px-3 py-1 rounded bg-emerald-600 text-black font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/teams/${teamId}/applications/${app.id}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'deny' }),
                              });
                              if (!res.ok) {
                                const txt = await res.text();
                                throw new Error(txt || 'Failed to deny applicant');
                              }
                              setApplications((prev) => prev.filter(a => a.id !== app.id));
                              setModalTitle('Applicant denied');
                              setModalMessage('The applicant has been denied.');
                              setModalVariant('info');
                              setModalOpen(true);
                            } catch (err) {
                              console.error(err);
                              setModalTitle('Deny failed');
                              setModalMessage((err as any)?.message || 'Failed to deny applicant');
                              setModalVariant('error');
                              setModalOpen(true);
                            }
                          }}
                          className="px-3 py-1 rounded bg-red-600 text-white font-semibold"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-teal-500/30 pt-8 mt-8">
            <div className="flex gap-3">
              {userRole ? (
                <Link
                  href="/puzzles"
                  className="flex-1 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-center transition-colors"
                >
                  Solve Puzzles as Team
                </Link>
              ) : (
                // Not a member: allow applying to public teams, otherwise prompt to sign in
                team.isPublic ? (
                    session?.user?.email ? (
                      inviteStatus === 'pending' ? (
                        <button disabled className="flex-1 px-6 py-3 rounded-lg bg-yellow-500 text-black font-semibold text-center transition-colors opacity-70 cursor-not-allowed">
                          Application submitted!
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            // optimistic UI: mark as pending immediately
                            setInviteStatus('pending');
                            try {
                              const res = await fetch(`/api/teams/${team.id}/apply`, { method: "POST" });
                              if (res.ok) {
                                setModalTitle('Application submitted');
                                setModalMessage('Your application was submitted. Team admins will be notified.');
                                setModalVariant('success');
                                setModalOpen(true);
                                return;
                              }

                              // Try parse json body for error details
                              let body: any = null;
                              try { body = await res.json(); } catch (e) { /* ignore */ }

                              const errorMsg = body?.error || (await res.text().catch(() => null)) || 'Failed to apply';

                              // If server indicates there's already a pending application, treat as pending
                              if (typeof errorMsg === 'string' && /pending|already/i.test(errorMsg)) {
                                setInviteStatus('pending');
                                setModalTitle('Application pending');
                                setModalMessage('You already have a pending application or invitation.');
                                setModalVariant('info');
                                setModalOpen(true);
                                return;
                              }

                              throw new Error(errorMsg);
                            } catch (err: any) {
                              console.error(err);
                              // Revert optimistic pending state if apply actually failed
                              setInviteStatus('none');
                              setModalTitle('Application failed');
                              setModalMessage(err?.message || 'Failed to submit application.');
                              setModalVariant('error');
                              setModalOpen(true);
                            }
                          }}
                          className="flex-1 px-6 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-black font-semibold text-center transition-colors"
                        >
                          Apply to Join
                        </button>
                      )
                    ) : (
                    <Link
                      href="/auth/signin"
                      className="flex-1 px-6 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-black font-semibold text-center transition-colors"
                    >
                      Sign in to Join
                    </Link>
                  )
                ) : null
              )}

              {userRole && ["admin", "moderator"].includes(userRole) && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  Invite Members
                </button>
              )}
              {userRole && (
                <button
                  onClick={() => setConfirmLeaveOpen(true)}
                  className="px-6 py-3 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold transition-colors"
                >
                  Leave Team
                </button>
              )}

              <button className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors">
                Team Stats
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {team && (
        <InviteTeamModal
          teamId={team.id}
          teamName={team.name}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            // Optionally refresh team data to show new member
          }}
        />
      )}
      <ConfirmModal
        isOpen={confirmOpen}
        title={`Remove member`}
        message={confirmMember ? `Are you sure you want to remove ${confirmMember.user.name || confirmMember.user.email} from the team?` : ''}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onCancel={() => { setConfirmOpen(false); setConfirmMember(null); }}
        onConfirm={async () => {
          if (!confirmMember) return;
          setConfirmOpen(false);
          try {
            const res = await fetch(`/api/teams/${team.id}/members/${confirmMember.user.id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
              let body: any = null;
              try { body = await res.json(); } catch (_) { /* ignore */ }
              const txt = body?.error || (await res.text().catch(() => null)) || 'Failed to remove member';
              throw new Error(txt);
            }
            // Refresh team members
            const t = await fetch(`/api/teams/${teamId}`);
            if (t.ok) setTeam(await t.json());
            setModalTitle('Member removed');
            setModalMessage(`${confirmMember.user.name || confirmMember.user.email} was removed from the team.`);
            setModalVariant('success');
            setModalOpen(true);
          } catch (err) {
            console.error(err);
            setModalTitle('Remove failed');
            setModalMessage((err as any)?.message || 'Failed to remove member');
            setModalVariant('error');
            setModalOpen(true);
          } finally {
            setConfirmMember(null);
          }
        }}
      />
      <ConfirmModal
        isOpen={confirmLeaveOpen}
        title={`Leave team`}
        message={`Are you sure you want to leave the team ${team.name}?`}
        confirmLabel="Leave"
        cancelLabel="Cancel"
        onCancel={() => setConfirmLeaveOpen(false)}
        onConfirm={async () => {
          setConfirmLeaveOpen(false);
          try {
            const res = await fetch(`/api/teams/${team.id}/membership`, { method: 'DELETE' });
            if (!res.ok) {
              // Prefer JSON error message when available
              let body: any = null;
              try { body = await res.json(); } catch (_) { /* ignore */ }
              const txt = body?.error || (await res.text().catch(() => null)) || 'Failed to leave team';
              throw new Error(txt);
            }
            setModalTitle('Left team');
            setModalMessage(`You have left ${team.name}.`);
            setModalVariant('success');
            setModalOpen(true);
            // show the modal briefly, then navigate back to teams list so user sees confirmation
            setTimeout(() => {
              try { router.push('/teams'); } catch (e) { /* ignore */ }
            }, 1200);
          } catch (err) {
            console.error(err);
            setModalTitle('Leave failed');
            setModalMessage((err as any)?.message || 'Failed to leave team');
            setModalVariant('error');
            setModalOpen(true);
          }
        }}
      />
      <ActionModal
        isOpen={modalOpen}
        title={modalTitle}
        message={modalMessage}
        variant={modalVariant}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

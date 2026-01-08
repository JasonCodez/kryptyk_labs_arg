"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import InviteTeamModal from "@/components/teams/InviteTeamModal";

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    const fetchTeam = async () => {
      try {
        const response = await fetch(`/api/teams/${teamId}`);
        if (!response.ok) throw new Error("Failed to fetch team");
        const data = await response.json();
        setTeam(data);
        
        // Find current user's role
        const userMember = data.members.find(
          (m: TeamMember) => m.user.email === session?.user?.email
        );
        if (userMember) {
          setUserRole(userMember.role);
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
                        {member.user.name || "Member"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      member.role === "admin"
                        ? "bg-teal-500/20 text-teal-300"
                        : "bg-slate-600/20 text-slate-300"
                    }`}
                  >
                    {member.role === "admin" ? "👑 Admin" : "Member"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-teal-500/30 pt-8 mt-8">
            <div className="flex gap-3">
              <Link
                href="/puzzles"
                className="flex-1 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-center transition-colors"
              >
                Solve Puzzles as Team
              </Link>
              {userRole && ["admin", "moderator"].includes(userRole) && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  Invite Members
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
    </div>
  );
}

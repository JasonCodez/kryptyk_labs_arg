"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import { CreateTeamModal } from "@/components/teams/CreateTeamModal";
import PendingInvitations from "@/components/teams/PendingInvitations";

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

export default function TeamsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchTeams();
      fetchInvitationCount();
    }
  }, [session?.user?.email]);

  const fetchInvitationCount = async () => {
    try {
      const response = await fetch("/api/teams/invitations");
      const invitations = await response.json();
      setInvitationCount(Array.isArray(invitations) ? invitations.length : 0);
    } catch (err) {
      console.error("Failed to fetch invitation count:", err);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch("/api/teams");
      if (!response.ok) throw new Error("Failed to fetch teams");
      const data = await response.json();
      setTeams(data);
    } catch (err) {
      setError("Failed to load teams");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div style={{ color: '#FDE74C' }} className="text-lg">Loading teams...</div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen pt-16">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">👥 Teams</h1>
              <p style={{ color: '#DDDBF1' }}>
                Collaborate with other players and solve puzzles together
              </p>
            </div>
            <div className="flex gap-3">
              {invitationCount > 0 && (
                <button
                  onClick={() => setShowInvitations(true)}
                  className="relative px-6 py-3 rounded-lg font-semibold transition-colors hover:opacity-90 flex items-center gap-2"
                  style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}
                >
                  <Mail className="w-5 h-5" />
                  Invitations
                  <span className="ml-2 px-2 py-1 rounded-full text-xs font-bold bg-orange-500">
                    {invitationCount}
                  </span>
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-lg text-white font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: '#FDE74C', color: '#000' }}
              >
                + Create Team
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
              {error}
            </div>
          )}

          {teams.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">👥</div>
              <p style={{ color: '#DDDBF1' }} className="text-lg mb-6">
                You haven't joined any teams yet
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2 rounded-lg text-white font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: '#FDE74C', color: '#000' }}
              >
                Create Your First Team
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => (
                <Link key={team.id} href={`/teams/${team.id}`}>
                  <div className="h-full border rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer group" style={{ backgroundColor: 'rgba(56, 145, 166, 0.1)', borderColor: '#3891A6' }}>
                    <div className="mb-4">
                      <h2 className="text-xl font-bold text-white group-hover:opacity-80 transition-colors">
                        {team.name}
                      </h2>
                      {team.description && (
                        <p style={{ color: '#DDDBF1' }} className="text-sm mt-2 line-clamp-2">
                          {team.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4" style={{ borderTopColor: '#3891A6', borderTopWidth: '1px' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: '#3891A6' }}>
                          {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                        </span>
                        {team.isPublic && (
                          <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300">
                            Public
                          </span>
                        )}
                      </div>
                      <span style={{ color: '#FDE74C' }} className="group-hover:opacity-80 transition-colors">
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <PendingInvitations
        isOpen={showInvitations}
        onClose={() => {
          setShowInvitations(false);
          fetchInvitationCount();
        }}
      />

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTeams();
          }}
        />
      )}
    </>
  );
}

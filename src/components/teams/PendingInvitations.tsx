"use client";

import React, { useState, useEffect } from "react";
import { format, formatDistance } from "date-fns";
import { Mail, CheckCircle, X, Clock, Users } from "lucide-react";

interface TeamInvitation {
  id: string;
  teamId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  team: {
    id: string;
    name: string;
    description?: string;
    members: Array<{
      id: string;
      user: {
        id: string;
        name?: string;
        image?: string;
      };
    }>;
  };
}

interface PendingInvitationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PendingInvitations({
  isOpen,
  onClose,
}: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
    }
  }, [isOpen]);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/teams/invitations");
      const data = await response.json();
      setInvitations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    invitationId: string,
    action: "accept" | "decline"
  ) => {
    setProcessing(invitationId);
    try {
      const response = await fetch("/api/teams/invitations/" + invitationId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, action }),
      });

      if (response.ok) {
        setInvitations(
          invitations.filter((inv) => inv.id !== invitationId)
        );
        // Refresh the list
        await fetchInvitations();
      }
    } catch (error) {
      console.error("Failed to process invitation:", error);
    } finally {
      setProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-screen w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">Team Invitations</h2>
            <p className="text-sm text-gray-400">
              {invitations.length}{" "}
              {invitations.length === 1 ? "invitation" : "invitations"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Loading invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
              <Mail className="w-12 h-12 text-gray-600" />
              <p className="text-gray-400 text-center">No pending invitations</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="p-4 hover:bg-slate-800/30 transition-colors"
                >
                  {/* Team Info */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-white mb-1">
                      {invitation.team.name}
                    </h3>
                    {invitation.team.description && (
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {invitation.team.description}
                      </p>
                    )}
                  </div>

                  {/* Team Members Preview */}
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">
                      {invitation.team.members.length}{" "}
                      {invitation.team.members.length === 1
                        ? "member"
                        : "members"}
                    </span>
                  </div>

                  {/* Member Avatars */}
                  {invitation.team.members.length > 0 && (
                    <div className="flex -space-x-2 mb-3">
                      {invitation.team.members.slice(0, 3).map((member) => (
                        <img
                          key={member.user.id}
                          src={
                            member.user.image ||
                            "https://api.dicebear.com/7.x/avataaars/svg?seed=" +
                              member.user.name
                          }
                          alt={member.user.name || "Member"}
                          className="w-7 h-7 rounded-full border-2 border-slate-900"
                          title={member.user.name || "Member"}
                        />
                      ))}
                      {invitation.team.members.length > 3 && (
                        <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs text-gray-300">
                          +{invitation.team.members.length - 3}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expiration Info */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <Clock className="w-3 h-3" />
                    Expires{" "}
                    {formatDistance(
                      new Date(invitation.expiresAt),
                      new Date(),
                      { addSuffix: true }
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(invitation.id, "accept")}
                      disabled={processing === invitation.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleAction(invitation.id, "decline")}
                      disabled={processing === invitation.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {invitations.length > 0 && (
          <div className="border-t border-slate-700 p-4">
            <p className="text-xs text-gray-500 text-center">
              Invitations expire after 7 days
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

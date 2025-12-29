"use client";

import React, { useState } from "react";
import { X, Mail, CheckCircle, AlertCircle } from "lucide-react";

interface InviteTeamModalProps {
  teamId: string;
  teamName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InviteTeamModal({
  teamId,
  teamName,
  isOpen,
  onClose,
  onSuccess,
}: InviteTeamModalProps) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const addEmailField = () => {
    setEmails([...emails, ""]);
  };

  const removeEmailField = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validEmails = emails.filter((email) => email.trim().length > 0);
    if (validEmails.length === 0) {
      setError("Please enter at least one email address");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/teams/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          userEmails: validEmails,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send invitations");
        return;
      }

      setSuccess(`Successfully sent ${data.count} invitation(s)`);
      setEmails([""]);
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError("An error occurred while sending invitations");
      console.error(err);
    } finally {
      setLoading(false);
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

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg shadow-xl border"
          style={{
            backgroundColor: "rgba(2, 2, 2, 0.95)",
            borderColor: "#3891A6",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-6 border-b"
            style={{ borderBottomColor: "#3891A6" }}
          >
            <h2 className="text-xl font-bold text-white">Invite to {teamName}</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Message */}
            {error && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "#EF4444",
                  borderWidth: "1px",
                }}
              >
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  borderColor: "#22C55E",
                  borderWidth: "1px",
                }}
              >
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-400">{success}</span>
              </div>
            )}

            {/* Email Fields */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                Email Addresses
              </label>
              {emails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="user@example.com"
                      className="w-full pl-9 pr-4 py-2 rounded-lg text-white placeholder-gray-500 transition-colors"
                      style={{
                        backgroundColor: "rgba(56, 145, 166, 0.1)",
                        borderColor: "#3891A6",
                        borderWidth: "1px",
                      }}
                    />
                  </div>
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Email Button */}
            <button
              type="button"
              onClick={addEmailField}
              className="text-sm font-medium transition-colors hover:text-blue-400"
              style={{ color: "#3891A6" }}
            >
              + Add Another Email
            </button>

            {/* Info Text */}
            <p className="text-sm text-gray-400">
              Invitations will expire in 7 days. Users must accept to join the team.
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t" style={{ borderTopColor: "#3891A6" }}>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg text-white transition-colors hover:opacity-80"
                style={{ backgroundColor: "rgba(56, 145, 166, 0.2)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !!success}
                className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: "#3891A6" }}
              >
                {loading ? "Sending..." : "Send Invitations"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

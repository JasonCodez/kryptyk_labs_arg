"use client";

import { useState } from "react";

interface CreateTeamModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTeamModal({ onClose, onSuccess }: CreateTeamModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to create team");
        return;
      }

      onSuccess();
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border rounded-lg p-8 w-full max-w-md" style={{ borderColor: 'rgba(56, 145, 166, 0.2)' }}>
        <h2 className="text-2xl font-bold text-white mb-6">Create New Team</h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter team name"
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#3891A6]"
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional team description"
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#3891A6]"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) =>
                setFormData({ ...formData, isPublic: e.target.checked })
              }
              className="w-4 h-4 rounded"
            />
            <label htmlFor="isPublic" className="text-white font-semibold">
              Public team (anyone can join)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-[#3891A6] hover:bg-[#2a7f8f] disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {loading ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

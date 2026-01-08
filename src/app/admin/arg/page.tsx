'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ARGPuzzleBuilder from '@/components/ARGPuzzleBuilder';

interface ARGPhase {
  id: string;
  name: string;
  description?: string;
  orderIndex: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  puzzles?: Array<{
    id: string;
    title: string;
    puzzleType: string;
    difficulty: string;
    isPublished: boolean;
  }>;
}

export default function AdminARGPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<ARGPhase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [phaseFormData, setPhaseFormData] = useState({
    name: '',
    description: '',
    orderIndex: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (status === 'unauthenticated') {
        redirect('/auth/signin');
      }

      if (status === 'authenticated' && session?.user?.email) {
        try {
          const response = await fetch('/api/admin/check');
          const data = await response.json();
          setIsAdmin(data.isAdmin);

          if (data.isAdmin) {
            fetchPhases();
          }
        } catch (error) {
          console.error('Failed to verify admin:', error);
        }
      }
      setLoading(false);
    };

    if (status !== 'loading') {
      checkAdmin();
    }
  }, [status, session]);

  const fetchPhases = async () => {
    try {
      const response = await fetch('/api/arg/phases');
      if (response.ok) {
        const data = await response.json();
        setPhases(data);
      }
    } catch (error) {
      console.error('Failed to fetch phases:', error);
    }
  };

  const handleCreatePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/arg/phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phaseFormData),
      });

      if (!response.ok) throw new Error('Failed to create phase');

      setMessage({ type: 'success', text: 'Phase created successfully!' });
      setPhaseFormData({ name: '', description: '', orderIndex: 1 });
      setShowPhaseForm(false);
      fetchPhases();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create phase',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main style={{ backgroundColor: '#020202' }} className="min-h-screen p-8">
        <div className="text-center text-white">Loading...</div>
      </main>
    );
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
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">🎮 ARG Puzzle Manager</h1>
              <p style={{ color: '#DDDBF1' }}>Create and manage multi-phase ARG experiences</p>
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

        {/* Messages */}
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

        {/* Phases Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Phases List */}
          <div
            className="lg:col-span-1 border rounded-lg p-6"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderColor: '#3891A6',
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Phases</h2>
              <button
                onClick={() => setShowPhaseForm(!showPhaseForm)}
                className="px-3 py-1 rounded text-sm text-white transition"
                style={{ backgroundColor: '#3891A6' }}
              >
                + New Phase
              </button>
            </div>

            {showPhaseForm && (
              <form onSubmit={handleCreatePhase} className="mb-6 space-y-3 p-4 rounded-lg bg-slate-900/50">
                <input
                  type="text"
                  placeholder="Phase name"
                  value={phaseFormData.name}
                  onChange={(e) => setPhaseFormData({ ...phaseFormData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white text-sm"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={phaseFormData.description}
                  onChange={(e) => setPhaseFormData({ ...phaseFormData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white text-sm"
                />
                <input
                  type="number"
                  placeholder="Order"
                  value={phaseFormData.orderIndex}
                  onChange={(e) => setPhaseFormData({ ...phaseFormData, orderIndex: parseInt(e.target.value) })}
                  min="1"
                  className="w-full px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded bg-[#3891A6] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Phase'}
                </button>
              </form>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {phases.length === 0 ? (
                <p className="text-gray-400 text-sm">No phases created yet</p>
              ) : (
                phases.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => setSelectedPhaseId(phase.id)}
                    className="w-full text-left p-3 rounded-lg transition"
                    style={{
                      backgroundColor:
                        selectedPhaseId === phase.id ? 'rgba(56, 145, 166, 0.3)' : 'rgba(56, 145, 166, 0.1)',
                      borderLeft:
                        selectedPhaseId === phase.id ? '3px solid #3891A6' : '3px solid transparent',
                    }}
                  >
                    <p className="font-semibold text-white text-sm">{phase.name}</p>
                    <p className="text-gray-400 text-xs">
                      {phase.puzzles?.length || 0} puzzles • Order: {phase.orderIndex}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Puzzle Builder */}
          <div
            className="lg:col-span-2 border rounded-lg p-6"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderColor: '#3891A6',
            }}
          >
            {selectedPhaseId ? (
              <ARGPuzzleBuilder phaseId={selectedPhaseId} />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">Select a phase to create puzzles</p>
                <button
                  onClick={() => setShowPhaseForm(true)}
                  className="px-4 py-2 rounded text-white transition"
                  style={{ backgroundColor: '#3891A6' }}
                >
                  Create Your First Phase
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Selected Phase Details */}
        {selectedPhaseId && phases.find((p) => p.id === selectedPhaseId) && (
          <div
            className="border rounded-lg p-6"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderColor: '#3891A6',
            }}
          >
            <h3 className="text-xl font-bold text-white mb-4">📋 Phase Puzzles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {phases
                .find((p) => p.id === selectedPhaseId)
                ?.puzzles?.map((puzzle) => (
                  <div key={puzzle.id} className="p-4 rounded-lg bg-slate-900/30 border border-slate-700">
                    <p className="font-semibold text-white mb-2">{puzzle.title}</p>
                    <div className="flex gap-2 text-xs">
                      <span
                        className="px-2 py-1 rounded capitalize"
                        style={{
                          backgroundColor: 'rgba(56, 145, 166, 0.3)',
                          color: '#3891A6',
                        }}
                      >
                        {puzzle.puzzleType}
                      </span>
                      <span
                        className="px-2 py-1 rounded capitalize"
                        style={{
                          backgroundColor: puzzle.difficulty === 'easy'
                            ? 'rgba(76, 175, 80, 0.3)'
                            : puzzle.difficulty === 'medium'
                              ? 'rgba(253, 231, 76, 0.3)'
                              : 'rgba(171, 159, 157, 0.3)',
                          color:
                            puzzle.difficulty === 'easy'
                              ? '#4CAF50'
                              : puzzle.difficulty === 'medium'
                                ? '#FDE74C'
                                : '#AB9F9D',
                        }}
                      >
                        {puzzle.difficulty}
                      </span>
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: puzzle.isPublished ? 'rgba(76, 175, 80, 0.3)' : 'rgba(171, 159, 157, 0.3)',
                          color: puzzle.isPublished ? '#4CAF50' : '#AB9F9D',
                        }}
                      >
                        {puzzle.isPublished ? '✓ Published' : '⊗ Draft'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface UserStats {
  totalPuzzlesSolved: number;
  totalPoints: number;
  currentTeams: number;
  rank: number | null;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      Promise.all([fetchUserStats(), fetchAdminStatus()]).finally(() => {
        setLoading(false);
      });
    }
  }, [session?.user?.email]);

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/user/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  const fetchAdminStatus = async () => {
    try {
      const response = await fetch('/api/admin/check');
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      // Log sign-out activity
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch (error) {
      console.error('Failed to log sign-out:', error);
    }
    try {
      // Call custom logout endpoint to clear session
      await fetch("/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Redirect to signin page
    window.location.href = '/auth/signin?logout=true';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <main style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      {/* Navigation */}
      <Navbar />

      {/* Content with padding for fixed navbar */}
      <div className="max-w-7xl mx-auto px-4 py-12 pt-24">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome back, {session.user.name || 'Player'}!</h1>
          <p style={{ color: '#3891A6' }}>Solve at your own pace—solo or with your team</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="border rounded-lg p-6" style={{ backgroundColor: 'rgba(56, 145, 166, 0.1)', borderColor: '#3891A6' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#3891A6' }}>Puzzles Solved</p>
            <p className="text-4xl font-bold text-white">{stats?.totalPuzzlesSolved || 0}</p>
          </div>

          <div className="border rounded-lg p-6" style={{ backgroundColor: 'rgba(253, 231, 76, 0.08)', borderColor: '#FDE74C' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#FDE74C' }}>Total Points</p>
            <p className="text-4xl font-bold text-white">{stats?.totalPoints || 0}</p>
          </div>

          <div className="border rounded-lg p-6" style={{ backgroundColor: 'rgba(221, 219, 241, 0.08)', borderColor: '#DDDBF1' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#DDDBF1' }}>Active Teams</p>
            <p className="text-4xl font-bold text-white">{stats?.currentTeams || 0}</p>
          </div>

          <div className="border rounded-lg p-6" style={{ backgroundColor: 'rgba(171, 159, 157, 0.1)', borderColor: '#AB9F9D' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#AB9F9D' }}>Global Rank</p>
            <p className="text-4xl font-bold text-white">#{stats?.rank || 'N/A'}</p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/puzzles"
            className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}
          >
            <div className="text-4xl mb-4">🧩</div>
            <h3 className="text-xl font-bold text-white mb-2">Start Solving</h3>
            <p style={{ color: '#DDDBF1' }}>Dive into active puzzles and earn points</p>
          </Link>

          <Link
            href="/teams"
            className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: 'rgba(253, 231, 76, 0.1)', borderColor: '#FDE74C' }}
          >
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-white mb-2">My Teams</h3>
            <p style={{ color: '#DDDBF1' }}>Manage teams and invite players</p>
          </Link>

          <Link
            href="/leaderboards"
            className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}
          >
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-2">Leaderboards</h3>
            <p style={{ color: '#DDDBF1' }}>Check global rankings and compete</p>
          </Link>

          <Link
            href="/categories"
            className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: 'rgba(253, 231, 76, 0.1)', borderColor: '#FDE74C' }}
          >
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-bold text-white mb-2">Browse Categories</h3>
            <p style={{ color: '#DDDBF1' }}>Explore puzzles by category</p>
          </Link>

          <Link
            href="/achievements"
            className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: 'rgba(171, 159, 157, 0.15)', borderColor: '#AB9F9D' }}
          >
            <div className="text-4xl mb-4">🎖️</div>
            <h3 className="text-xl font-bold text-white mb-2">Achievements</h3>
            <p style={{ color: '#DDDBF1' }}>Unlock badges and earn recognition</p>
          </Link>

          <Link
            href="/settings"
            className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}
          >
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-xl font-bold text-white mb-2">Settings</h3>
            <p style={{ color: '#DDDBF1' }}>Manage your account and preferences</p>
          </Link>

          <Link
            href="/dashboard/activity"
            className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: 'rgba(253, 231, 76, 0.1)', borderColor: '#FDE74C' }}
          >
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-white mb-2">Activity Feed</h3>
            <p style={{ color: '#DDDBF1' }}>View your recent activities and account changes</p>
          </Link>

          {isAdmin && (
            <>
              <Link
                href="/admin/analytics"
                className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
                style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}
              >
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-white mb-2">Analytics</h3>
                <p style={{ color: '#DDDBF1' }}>View platform statistics and puzzle analytics</p>
              </Link>
              <Link
                href="/admin/puzzles"
                className="border rounded-lg p-8 transition transform hover:scale-105 hover:shadow-lg"
                style={{ backgroundColor: 'rgba(171, 159, 157, 0.15)', borderColor: '#AB9F9D' }}
              >
                <div className="text-4xl mb-4">➕</div>
                <h3 className="text-xl font-bold text-white mb-2">Create Puzzle</h3>
                <p style={{ color: '#DDDBF1' }}>Add new puzzles to the game (Admin)</p>
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

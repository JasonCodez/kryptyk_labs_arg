'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rarity, rarityColors } from '@/lib/rarity';

interface UserProfile {
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  totalPuzzlesSolved: number;
  totalPoints: number;
  rank: number | null;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [unlockedBadges, setUnlockedBadges] = useState<Array<{ id: string; title: string; icon: string; rarity: Rarity; unlockedAt?: string }>>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch unlocked badges for display on profile
  useEffect(() => {
    if (session?.user?.email) {
      const fetchBadges = async () => {
        setBadgesLoading(true);
        try {
          const res = await fetch('/api/user/achievements');
          if (res.ok) {
            const result = await res.json();
            const unlocked = (result?.achievements || []).filter((a: any) => a.unlocked).map((a: any) => ({
              id: a.id,
              title: a.title,
              icon: a.icon,
              rarity: a.rarity as Rarity,
              unlockedAt: a.unlockedAt,
            }));
            setUnlockedBadges(unlocked);
          }
        } catch (err) {
          console.error('Failed to fetch badges:', err);
        } finally {
          setBadgesLoading(false);
        }
      };
      fetchBadges();
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchProfile();
    }
  }, [session?.user?.email]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setFormData({ name: data.name || '', email: data.email || '' });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        setEditing(false);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError('An error occurred');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      const preview = URL.createObjectURL(file);
      setAvatarPreview(preview);
      setError('');
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', avatarFile);

    try {
      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfile((prev) => prev ? { ...prev, image: data.image } : null);
        setAvatarFile(null);
        setAvatarPreview(null);
        setSuccess('Avatar updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to upload avatar');
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      setError('An error occurred while uploading');
    } finally {
      setUploadingAvatar(false);
    }
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
    <main style={{ backgroundColor: '#020202' }} className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50" style={{ backgroundColor: 'rgba(2, 2, 2, 0.95)', borderBottomColor: '#3891A6', borderBottomWidth: '1px' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-8 w-auto" />
            <div className="text-xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {profile?.image && (
              <img src={profile.image} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
            )}
            <span className="text-sm text-white">{session.user.name || session.user.email}</span>
            <button
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout");
                } catch (error) {
                  console.error("Logout error:", error);
                }
                window.location.href = '/auth/signin?logout=true';
              }}
              className="px-3 py-1.5 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: '#AB9F9D' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="pt-24 pb-16 px-4" style={{ backgroundImage: 'linear-gradient(135deg, rgba(56, 145, 166, 0.1) 0%, rgba(253, 231, 76, 0.05) 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-2">My Profile</h1>
          <p style={{ color: '#DDDBF1' }}>Manage your account and view your stats</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-12 max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(56, 145, 166, 0.2)', borderColor: '#3891A6' }}>
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Avatar Card */}
          <div className="border rounded-lg p-8" style={{ backgroundColor: 'rgba(253, 231, 76, 0.06)', borderColor: '#FDE74C' }}>
            <h3 className="text-lg font-bold text-white mb-6">Avatar</h3>
            <div className="flex flex-col items-center space-y-4">
              {/* Current Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center overflow-hidden border-2" style={{ borderColor: '#FDE74C' }}>
                {profile?.image ? (
                  <img src={profile.image} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">👤</span>
                )}
              </div>

              {/* Avatar Preview */}
              {avatarPreview && (
                <div className="w-24 h-24 rounded-full overflow-hidden border-2" style={{ borderColor: '#3891A6' }}>
                  <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                </div>
              )}

              {/* File Input */}
              <label className="w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <span className="block w-full px-4 py-2 rounded-lg text-center text-sm font-semibold text-white transition cursor-pointer hover:opacity-90" style={{ backgroundColor: '#3891A6' }}>
                  Choose Image
                </span>
              </label>

              {/* Upload Button */}
              {avatarFile && (
                <button
                  onClick={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#FDE74C', color: '#020202' }}
                >
                  {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                </button>
              )}

              <p className="text-xs" style={{ color: '#AB9F9D' }}>Max 5MB, JPG/PNG</p>
            </div>
          </div>

          {/* Profile Card */}
          <div className="md:col-span-2 md:row-span-2 border rounded-lg p-8" style={{ backgroundColor: 'rgba(56, 145, 166, 0.08)', borderColor: '#3891A6' }}>
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Account Information</h2>
              <button
                onClick={() => setEditing(!editing)}
                className="px-4 py-2 rounded text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: '#3891A6', color: 'white' }}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#DDDBF1' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border text-white"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: '#3891A6' }}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#DDDBF1' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-2 rounded-lg border text-white opacity-50 cursor-not-allowed"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: '#3891A6' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#AB9F9D' }}>Email cannot be changed</p>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-3 rounded-lg font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: '#3891A6' }}
                >
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm" style={{ color: '#AB9F9D' }}>Name</p>
                  <p className="text-lg font-semibold text-white">{profile?.name || 'Not set'}</p>
                </div>

                <div style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)', borderTopWidth: '1px', paddingTop: '16px' }}>
                  <p className="text-sm" style={{ color: '#AB9F9D' }}>Email</p>
                  <p className="text-lg font-semibold text-white">{profile?.email}</p>
                </div>

                <div style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)', borderTopWidth: '1px', paddingTop: '16px' }}>
                  <p className="text-sm" style={{ color: '#AB9F9D' }}>Role</p>
                  <p className="text-lg font-semibold">
                    <span className="px-3 py-1 rounded text-sm" style={{ backgroundColor: profile?.role === 'admin' ? 'rgba(171, 159, 157, 0.3)' : 'rgba(253, 231, 76, 0.2)', color: profile?.role === 'admin' ? '#AB9F9D' : '#FDE74C' }}>
                      {profile?.role === 'admin' ? '👑 Administrator' : '🎮 Player'}
                    </span>
                  </p>
                </div>

                <div style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)', borderTopWidth: '1px', paddingTop: '16px' }}>
                  <p className="text-sm" style={{ color: '#AB9F9D' }}>Member Since</p>
                  <p className="text-lg font-semibold text-white">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stats Card */}
          <div className="border rounded-lg p-6 space-y-6" style={{ backgroundColor: 'rgba(253, 231, 76, 0.06)', borderColor: '#FDE74C' }}>
            <h3 className="text-lg font-bold text-white">Your Stats</h3>

            <div>
              <p className="text-sm" style={{ color: '#FDE74C' }}>Puzzles Solved</p>
              <p className="text-3xl font-bold text-white">{profile?.totalPuzzlesSolved || 0}</p>
            </div>

            <div>
              <p className="text-sm" style={{ color: '#FDE74C' }}>Total Points</p>
              <p className="text-3xl font-bold text-white">{profile?.totalPoints || 0}</p>
            </div>

            <div>
              <p className="text-sm" style={{ color: '#FDE74C' }}>Global Rank</p>
              <p className="text-3xl font-bold text-white">#{profile?.rank || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Unlocked Badges */}
        <div className="mb-8">
          <div className="border rounded-lg p-6" style={{ backgroundColor: 'rgba(56, 145, 166, 0.04)', borderColor: '#3891A6' }}>
            <h3 className="text-lg font-bold text-white mb-4">Unlocked Badges</h3>
            {badgesLoading ? (
              <p className="text-sm" style={{ color: '#AB9F9D' }}>Loading badges...</p>
            ) : unlockedBadges.length === 0 ? (
              <p className="text-sm" style={{ color: '#AB9F9D' }}>No badges unlocked yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {unlockedBadges.map((b) => {
                  const color = rarityColors[b.rarity] || rarityColors.common;
                  return (
                    <div key={b.id} className="flex flex-col items-center p-3 rounded border" style={{ backgroundColor: color.bg, borderColor: color.border }}>
                      <div className="text-3xl mb-2">{b.icon}</div>
                      <div className="text-sm font-semibold" style={{ color: color.text }}>{b.title}</div>
                      {b.unlockedAt && <div className="text-xs" style={{ color: '#AB9F9D' }}>{new Date(b.unlockedAt).toLocaleDateString()}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Link
            href="/dashboard"
            className="border rounded-lg p-6 transition hover:scale-105"
            style={{ backgroundColor: 'rgba(56, 145, 166, 0.08)', borderColor: '#3891A6' }}
          >
            <h3 className="text-lg font-bold text-white mb-2">← Back to Dashboard</h3>
            <p style={{ color: '#DDDBF1' }}>Return to your dashboard</p>
          </Link>

          <Link
            href="/leaderboards"
            className="border rounded-lg p-6 transition hover:scale-105"
            style={{ backgroundColor: 'rgba(253, 231, 76, 0.06)', borderColor: '#FDE74C' }}
          >
            <h3 className="text-lg font-bold text-white mb-2">🏆 View Leaderboards</h3>
            <p style={{ color: '#DDDBF1' }}>See how you rank globally</p>
          </Link>
        </div>
      </div>
    </main>
  );
}

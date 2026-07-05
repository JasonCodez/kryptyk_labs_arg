"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { PuzzleSkinContext } from "@/contexts/PuzzleSkinContext";
import Link from "next/link";
import ConfirmModal from '@/components/ConfirmModal';
import { Rarity, rarityColors } from '@/lib/rarity';
import { THEME_CONFIGS, FRAME_CONFIGS, getThemeConfig, getTopBarGradient } from '@/lib/profileThemes';
import AvatarFrame, { type FrameConfig } from '@/components/AvatarFrame';
import { normalizeUserImageUrl } from '@/lib/userImage';
import {
  UserPlus,
  UserMinus,
  Trophy,
  Users,
  Heart,
  Share2,
  MessageCircle,
  MoreHorizontal,
  Ban,
  Flag,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  image: string | null;
  createdAt: string;
  xp: number;
  level: number;
  xpTitle: string;
  xpProgress: number;
  xpToNextLevel: number;
  activeFlair: string;
  isPremium?: boolean;
  activeFrame: string;
  activeTheme: string;
  activeSkin: string;
  achievements: Array<{
    id: string;
    achievement: {
      id: string;
      name: string;
      title: string;
      description: string;
      icon: string;
      category: string;
      rarity: string;
    };
  }>;
  teams: Array<{
    id: string;
    team: {
      id: string;
      name: string;
      description: string;
    };
  }>;
  stats: {
    puzzlesSolved: number;
    totalPoints: number;
    achievementsCount: number;
    teamsCount: number;
  };
  social: {
    followers: number;
    following: number;
    isFollowing: boolean;
  };
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserNameChanged, setCurrentUserNameChanged] = useState<boolean>(false);
  const [showNameChangeConfirm, setShowNameChangeConfirm] = useState<boolean>(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userTeams, setUserTeams] = useState<Array<{ id: string; name: string; memberCount: number }>>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [showMyPuzzles, setShowMyPuzzles] = useState(false);
  const [myPuzzles, setMyPuzzles] = useState<Array<any>>([]);
  const [myPuzzlesLoading, setMyPuzzlesLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  useEffect(() => {
    // Fetch current authenticated user's id for accurate ownership checks
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/user/info');
        if (res.ok) {
          const data = await res.json();
          if (data?.id) setCurrentUserId(data.id);
          setCurrentUserNameChanged(!!data?.nameChanged);
        }
      } catch (err) {
        // ignore silently; ownership will fall back to session if available
        console.debug('Could not fetch current user id', err);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!userId || !session) return;
    fetch(`/api/users/${userId}/block`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsBlocked(d.blocked); })
      .catch(() => {});
  }, [userId, session]);

  const fetchProfile = async () => {
    if (!userId) {
      setError("User ID is missing");
      setLoading(false);
      console.error("userId is empty or undefined");
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch profile`);
      }
      const data = await response.json();
      console.log("[PublicProfile] activeTheme from API:", data.activeTheme, "activeSkin:", data.activeSkin);
      setProfile(data);
      setIsFollowing(data.social.isFollowing);
      setError("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load profile";
      setError(errorMessage);
      console.error("Profile fetch error:", { userId, error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isFollowing ? "unfollow" : "follow",
        }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        await fetchProfile();
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
    }
  };

  const fetchUserTeams = async () => {
    try {
      const response = await fetch("/api/teams/user-teams");
      if (response.ok) {
        const data = await response.json();
        setUserTeams(data.teams || []);
      }
    } catch (err) {
      console.error("Failed to fetch user teams:", err);
      setInviteError("Failed to load your teams");
    }
  };

  const handleSendTeamInvite = async () => {
    if (!selectedTeam) {
      setInviteError("Please select a team");
      return;
    }

    setInviteLoading(true);
    setInviteError("");

    try {
      const response = await fetch("/api/teams/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeam,
          userId: userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invite");
      }

      setShowInviteModal(false);
      setSelectedTeam("");
      setInviteError(""); // Show success message in snackbar instead
      alert("Team invitation sent successfully!");
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to send invite"
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdateName = async () => {
    const candidate = newName.trim();
    if (!candidate) {
      setNameError("Name cannot be empty");
      return;
    }
    // Client-side validation: use same rules including banned words
    try {
      const { isAllowedDisplayName } = await import('@/lib/display-name-validator');
      const v = isAllowedDisplayName(candidate);
      if (!v.ok) {
        setNameError(v.reason || 'Invalid name');
        return;
      }
    } catch (e) {
      // fallback to simple regexp if import fails
      const validRe = /^[A-Za-z0-9]{3,16}$/;
      if (!validRe.test(candidate)) {
        setNameError('Name must be 3-16 characters and contain only letters and numbers');
        return;
      }
    }

    setNameSaving(true);
    setNameError("");

    try {
      const response = await fetch("/api/user/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update name");
      }

      // Update local profile
      if (profile) {
        setProfile({ ...profile, name: newName.trim() });
      }
      // mark name as changed so edit UI is no longer available
      setCurrentUserNameChanged(true);
      setIsEditingName(false);
      setNewName("");
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setNameSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
      setTimeout(() => setAvatarError(""), 5000);
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setAvatarError("File too large. Maximum size is 5MB");
      setTimeout(() => setAvatarError(""), 5000);
      return;
    }

    setAvatarUploading(true);
    setAvatarError("");

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/user/upload-avatar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Update local profile state
        if (profile) {
          setProfile({ ...profile, image: data.imageUrl });
        }
      } else {
        setAvatarError(data.error || "Failed to upload avatar");
        setTimeout(() => setAvatarError(""), 5000);
      }
    } catch (err) {
      setAvatarError("An error occurred while uploading your avatar");
      setTimeout(() => setAvatarError(""), 5000);
      console.error("Avatar upload error:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div style={{ color: '#FDE74C' }} className="text-lg">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div style={{ color: '#AB9F9D' }} className="text-lg">{error || "Profile not found"}</div>
      </div>
    );
  }

  const isOwnProfile = (currentUserId || (session?.user as any)?.id) === userId;

  // Use the same theme system as the own-profile page
  const t = getThemeConfig(profile.activeTheme);
  const topBar = getTopBarGradient(t);
  const frame = FRAME_CONFIGS[profile.activeFrame || 'none'] ?? FRAME_CONFIGS.none;
  const flair = profile.activeFlair && profile.activeFlair !== 'none' ? <span style={{ display: 'inline-block', transform: 'translateY(-4px)' }}> {profile.activeFlair}</span> : null;
  const btnStyle = t.btnPrimary.startsWith('linear')
    ? { background: t.btnPrimary, color: t.btnPrimaryText }
    : { backgroundColor: t.btnPrimary, color: t.btnPrimaryText };
  const avatarSrc = normalizeUserImageUrl(profile.image);

  // Render avatar (shared helper)
  const renderAvatar = (sizeClass: string) => {
    const sizePx = sizeClass.includes('w-24') ? 96 : 80;
    if (frame.colorA) {
      return (
        <AvatarFrame
          frame={frame as FrameConfig}
          size={sizePx}
          pageBg={t.pageBg}
        >
          {avatarSrc
            ? <img src={avatarSrc} alt={profile.name} className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
            : <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: t.primaryMuted }}>👤</div>}
        </AvatarFrame>
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden border-[3px] flex-shrink-0 flex items-center justify-center`}
        style={{ borderColor: t.primary, boxShadow: `0 0 18px ${t.avatarGlow}, 0 0 40px ${t.avatarGlow}` }}
      >
        {avatarSrc
          ? <img src={avatarSrc} alt={profile.name} className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
          : <div className="w-full h-full flex items-center justify-center text-4xl" style={{ backgroundColor: t.primaryMuted }}>👤</div>}
      </div>
    );
  };

  return (
    <PuzzleSkinContext.Provider value={profile.activeSkin || "default"}>
    <main style={{ backgroundColor: t.pageBg, transition: 'background-color 0.4s ease' }} className="min-h-screen">

      {/* Theme accent bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-50" style={{ background: topBar, boxShadow: `0 0 12px ${t.avatarGlow}` }} />

      {/* Animated header — same as own-profile page */}
      <div className="pt-24 pb-20 px-4 relative overflow-hidden" style={{ background: t.headerGradient }}>
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: t.headerParticle1, filter: 'blur(70px)', transform: 'translateY(-30%)' }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full pointer-events-none" style={{ background: t.headerParticle2, filter: 'blur(55px)', transform: 'translateY(30%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: topBar, opacity: 0.7 }} />
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {renderAvatar('w-20 h-20')}
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-extrabold text-white mb-1">{profile.name || 'Player'}{profile.isPremium ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> 💎</span> : ''}{flair}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: t.primaryMuted, color: t.primary, border: `1px solid ${t.primary}`, boxShadow: `0 0 8px ${t.avatarGlow}` }}>
                  LVL {profile.level} &middot; {profile.xpTitle}
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: t.subtleText }}>Member since {new Date(profile.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-8 max-w-4xl mx-auto">
        {/* Action buttons for visitors */}
        {!isOwnProfile && (
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <button
              onClick={handleFollowToggle}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              style={{
                backgroundColor: isFollowing ? '#EF4444' : '#38A169',
                color: 'white',
              }}
            >
              {isFollowing ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
            </button>
            <button
              onClick={() => { setShowInviteModal(true); fetchUserTeams(); }}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              style={{ backgroundColor: '#2563EB', color: 'white' }}
            >
              <Users className="w-4 h-4" /> Invite to Team
            </button>
            {session && (
              <button
                onClick={() => setShowMessageModal(true)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                style={btnStyle as React.CSSProperties}
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            )}
            <Link
              href={`/warz?invite=${userId}`}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              style={{ backgroundColor: '#7c3aed', color: 'white' }}
            >
              ⚔️ Challenge to Warz
            </Link>
            {/* More ⋯ menu */}
            {session && (
              <div className="relative ml-auto" style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => setShowMoreMenu(v => !v)}
                  title="More options"
                  className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6B7280' }}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 w-48 rounded-xl overflow-hidden z-50"
                      style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
                    >
                      <button
                        onClick={() => { setShowMoreMenu(false); setShowBlockConfirm(true); }}
                        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm transition-colors hover:bg-white/5"
                        style={{ color: isBlocked ? '#10B981' : '#EF4444' }}
                      >
                        <Ban className="w-4 h-4" />
                        {isBlocked ? 'Unblock User' : 'Block User'}
                      </button>
                      <button
                        onClick={() => { setShowMoreMenu(false); setShowReportModal(true); }}
                        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm transition-colors hover:bg-white/5"
                        style={{ color: '#F59E0B' }}
                      >
                        <Flag className="w-4 h-4" />
                        Report Abuse
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* XP Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: t.primaryMuted, border: `1px solid ${t.primary}`, color: t.primary }}>
              Lv.{profile.level}
            </span>
            <span className="text-sm font-semibold" style={{ color: t.primary }}>{profile.xpTitle}</span>
            <span className="text-xs ml-auto" style={{ color: t.subtleText }}>{profile.xpToNextLevel} XP to next level</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden w-full max-w-xs" style={{ background: t.primaryMuted }}>
            <div className="h-full rounded-full" style={{ width: `${profile.xpProgress}%`, background: t.xpBarGradient }} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid justify-items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg p-4 flex flex-col items-center text-center gap-2 w-full" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <Trophy className="w-8 h-8 mx-auto" style={{ color: t.primary }} />
            <p style={{ color: t.subtleText }} className="text-sm mb-1">Puzzles Solved</p>
            <p className="text-4xl font-extrabold" style={{ color: t.primary }}>{profile.stats.puzzlesSolved}</p>
          </div>
          <div className="rounded-lg p-4 flex flex-col items-center text-center gap-2 w-full" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <Share2 className="w-8 h-8 mx-auto" style={{ color: t.primary }} />
            <p style={{ color: t.subtleText }} className="text-sm mb-1">Total Points</p>
            <p className="text-4xl font-extrabold" style={{ color: t.primary }}>{profile.stats.totalPoints}</p>
          </div>
          <div className="rounded-lg p-4 flex flex-col items-center text-center gap-2 w-full" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <Trophy className="w-8 h-8 mx-auto" style={{ color: t.primary }} />
            <p style={{ color: t.subtleText }} className="text-sm mb-1">Achievements</p>
            <p className="text-4xl font-extrabold" style={{ color: t.primary }}>{profile.stats.achievementsCount}</p>
          </div>
          <div className="rounded-lg p-4 flex flex-col items-center text-center gap-2 w-full" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <Users className="w-8 h-8 mx-auto" style={{ color: t.primary }} />
            <p style={{ color: t.subtleText }} className="text-sm mb-1">Teams</p>
            <p className="text-4xl font-extrabold" style={{ color: t.primary }}>{profile.stats.teamsCount}</p>
          </div>
        </div>

        {/* Social Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border rounded-lg p-4" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ color: t.subtleText }} className="text-sm mb-1">Followers</p>
                <p className="text-2xl font-bold text-white">{profile.social.followers}</p>
              </div>
              <Heart className="w-8 h-8" style={{ color: '#EF4444' }} />
            </div>
          </div>
          <div className="border rounded-lg p-4" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ color: t.subtleText }} className="text-sm mb-1">Following</p>
                <p className="text-2xl font-bold text-white">{profile.social.following}</p>
              </div>
              <Users className="w-8 h-8" style={{ color: t.primary }} />
            </div>
          </div>
        </div>

        {/* My Puzzles Archive (own profile only) */}
        {isOwnProfile && (
          <div className="mb-8">
            <div className="border rounded-lg p-6" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">My Puzzles (Archive)</h3>
                <button
                  onClick={async () => {
                    setShowMyPuzzles(!showMyPuzzles);
                    if (!showMyPuzzles && myPuzzles.length === 0) {
                      setMyPuzzlesLoading(true);
                      try {
                        const res = await fetch('/api/user/puzzles');
                        if (res.ok) {
                          const data = await res.json();
                          setMyPuzzles(data);
                        }
                      } catch (e) {
                        console.error('Failed to fetch my puzzles:', e);
                      } finally {
                        setMyPuzzlesLoading(false);
                      }
                    }
                  }}
                  className="px-4 py-2 rounded text-sm font-semibold transition hover:opacity-90"
                  style={btnStyle as React.CSSProperties}
                >
                  {showMyPuzzles ? 'Hide' : 'Open'}
                </button>
              </div>

              {showMyPuzzles && (
                <div>
                  {myPuzzlesLoading ? (
                    <p className="text-sm" style={{ color: t.subtleText }}>Loading...</p>
                  ) : myPuzzles.length === 0 ? (
                    <p className="text-sm" style={{ color: t.subtleText }}>No archived puzzles yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {myPuzzles.map((p) => (
                        <div key={p.id} className="block border rounded p-3" style={{ borderColor: t.primaryBorder, backgroundColor: t.primaryMuted }} role="group" aria-disabled="true">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-white">{p.title}</h4>
                              <p className="text-xs" style={{ color: t.subtleText }}>{p.category?.name || 'General'} · {p.difficulty}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: p.solved ? 'rgba(56, 201, 153, 0.12)' : 'rgba(239, 68, 68, 0.08)', color: p.solved ? '#38D399' : '#EF4444' }}>
                                {p.solved ? '✓ Solved' : '✗ Failed'}
                              </span>
                              <div className="text-xs mt-1" style={{ color: t.subtleText }}>{p.attempts ?? 0} attempts</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teams Section */}
        {profile.teams.length > 0 && (
          <div className="border rounded-lg p-6 mb-8" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" style={{ color: t.primary }} />
              Teams ({profile.teams.length})
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {profile.teams.map((tm) => (
                <Link
                  key={tm.team.id}
                  href={`/teams/${tm.team.id}`}
                  className="p-4 rounded-lg border transition-all hover:shadow-lg cursor-pointer"
                  style={{ backgroundColor: t.primaryMuted, borderColor: t.primaryBorder }}
                >
                  <h3 className="font-semibold text-white mb-1">{tm.team.name}</h3>
                  {tm.team.description && (
                    <p style={{ color: t.subtleText }} className="text-sm line-clamp-2">{tm.team.description}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Section */}
        {profile.achievements.length > 0 && (
          <div className="border rounded-lg p-6" style={{ backgroundColor: t.cardBg, borderColor: t.secondary }}>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6" style={{ color: t.secondary }} />
              Achievements ({profile.achievements.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {profile.achievements.map((ach) => {
                const rarityKey = (ach.achievement.rarity || 'common') as Rarity;
                const color = rarityColors[rarityKey] || rarityColors.common;
                return (
                  <div
                    key={ach.id}
                    className="p-4 rounded-lg border text-center transition-all hover:shadow-lg"
                    style={{ backgroundColor: color.bg, borderColor: t.primary }}
                    title={ach.achievement.description}
                  >
                    <div className="text-4xl mb-2">{ach.achievement.icon}</div>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: color.text }}>{ach.achievement.title}</h3>
                    <p style={{ color: t.subtleText }} className="text-xs mb-2">{ach.achievement.category}</p>
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold capitalize" style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
                      {ach.achievement.rarity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {profile.achievements.length === 0 && profile.teams.length === 0 && (
          <div className="text-center py-12">
            <p style={{ color: t.subtleText }} className="text-lg">
              This player hasn't earned any achievements or joined teams yet.
            </p>
          </div>
        )}
      </div>

      {/* Message Modal */}
      {showMessageModal && !isOwnProfile && (
        <DirectMessageModal
          targetUserId={userId}
          targetUserName={profile.name}
          onClose={() => setShowMessageModal(false)}
          accentColor={t.primary}
          accentMuted={t.primaryMuted}
          btnBg={t.btnPrimary}
          btnText={t.btnPrimaryText}
        />
      )}

      {/* Team Invite Modal */}
      {showInviteModal && !isOwnProfile && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowInviteModal(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-lg shadow-xl border p-6"
              style={{
                backgroundColor: "rgba(2, 2, 2, 0.97)",
                borderColor: t.primary,
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Invite to Team
              </h2>

              {inviteError && (
                <div
                  className="p-3 rounded-lg text-sm mb-4"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "#EF4444",
                    borderWidth: "1px",
                    color: "#FCA5A5",
                  }}
                >
                  {inviteError}
                </div>
              )}

              {userTeams.length === 0 ? (
                <div
                  className="p-4 rounded-lg text-center"
                  style={{
                    backgroundColor: t.cardBg,
                    borderColor: t.primary,
                    borderWidth: "1px",
                    color: "#DDDBF1",
                  }}
                >
                  <p>You haven't created or joined any teams yet.</p>
                  <Link
                    href="/teams"
                    className="mt-4 inline-block px-4 py-2 rounded-lg font-medium transition-colors"
                    style={btnStyle as React.CSSProperties}
                  >
                    Create a Team
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                    {userTeams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center p-3 rounded-lg cursor-pointer transition-colors"
                        style={{
                          backgroundColor:
                            selectedTeam === team.id
                              ? t.primaryMuted
                              : "rgba(51, 65, 85, 0.5)",
                          borderColor: selectedTeam === team.id ? t.primary : "#475569",
                          borderWidth: "1px",
                        }}
                      >
                        <input
                          type="radio"
                          name="team"
                          value={team.id}
                          checked={selectedTeam === team.id}
                          onChange={(e) => setSelectedTeam(e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <p className="text-white font-semibold">{team.name}</p>
                          <p style={{ color: "#DDDBF1" }} className="text-sm">
                            {team.memberCount}/4 members
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 px-4 py-2 rounded-lg text-white transition-colors"
                      style={{ backgroundColor: t.primaryMuted }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleSendTeamInvite}
                      disabled={inviteLoading || !selectedTeam}
                      className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                      style={btnStyle as React.CSSProperties}
                    >
                      {inviteLoading ? "Sending..." : "Send Invite"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block confirm */}
      <ConfirmModal
        isOpen={showBlockConfirm}
        title={isBlocked ? `Unblock ${profile.name}?` : `Block ${profile.name}?`}
        message={
          isBlocked
            ? 'They will be able to see your profile and interact with you again.'
            : "They won\u2019t be able to send you messages. Any existing follow will be removed."
        }
        confirmLabel={isBlocked ? 'Unblock' : 'Block'}
        cancelLabel="Cancel"
        onConfirm={async () => {
          setShowBlockConfirm(false);
          const res = await fetch(`/api/users/${userId}/block`, { method: 'POST' });
          if (res.ok) {
            const d = await res.json();
            setIsBlocked(d.blocked);
            if (d.blocked) setIsFollowing(false);
          }
        }}
        onCancel={() => setShowBlockConfirm(false)}
      />

      {/* Report abuse modal */}
      {showReportModal && (
        <ReportModal
          targetUserId={userId}
          targetUserName={profile.name}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* One-time name-change confirmation modal */}
      <ConfirmModal
        isOpen={showNameChangeConfirm}
        title="Change display name"
        message="You may only change your display name once. Are you sure you want to continue?"
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowNameChangeConfirm(false);
          setIsEditingName(true);
          setNewName(profile?.name || "");
          setNameError("");
        }}
        onCancel={() => setShowNameChangeConfirm(false)}
      />
    </main>
    </PuzzleSkinContext.Provider>
  );
}

function DirectMessageModal({
  targetUserId,
  targetUserName,
  onClose,
  accentColor = '#3891A6',
  accentMuted = 'rgba(56,145,166,0.15)',
  btnBg = '#3891A6',
  btnText = '#fff',
}: {
  targetUserId: string;
  targetUserName: string;
  onClose: () => void;
  accentColor?: string;
  accentMuted?: string;
  btnBg?: string;
  btnText?: string;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Message cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${targetUserId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });

      if (response.ok) {
        setSuccess(true);
        setMessage("");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError("Failed to send message");
      }
    } catch (err) {
      setError("An error occurred while sending message");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg shadow-xl border p-6"
          style={{
            backgroundColor: "rgba(2, 2, 2, 0.97)",
            borderColor: accentColor,
          }}
        >
          <h2 className="text-xl font-bold text-white mb-4">
            Message {targetUserName}
          </h2>

          <form onSubmit={handleSendMessage} className="space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "#EF4444",
                  borderWidth: "1px",
                  color: "#FCA5A5",
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  borderColor: "#22C55E",
                  borderWidth: "1px",
                  color: "#86EFAC",
                }}
              >
                Message sent!
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              maxLength={5000}
              rows={4}
              className="w-full px-4 py-2 rounded-lg text-white placeholder-gray-500 resize-none"
              style={{
                backgroundColor: accentMuted,
                borderColor: accentColor,
                borderWidth: "1px",
              }}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg text-white transition-colors"
                style={{ backgroundColor: accentMuted }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: btnBg, color: btnText } as React.CSSProperties}
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const REPORT_REASONS: Array<{ value: string; label: string }> = [
  { value: "harassment",   label: "Harassment or bullying" },
  { value: "hate_speech",  label: "Hate speech" },
  { value: "spam",         label: "Spam or scam" },
  { value: "impersonation",label: "Impersonation" },
  { value: "cheating",     label: "Cheating / exploits" },
  { value: "other",        label: "Other" },
];

function ReportModal({
  targetUserId,
  targetUserName,
  onClose,
}: {
  targetUserId: string;
  targetUserName: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reason) { setError("Please select a reason."); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${targetUserId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(onClose, 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to submit report.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{ background: "#0d0d0d", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 0 48px rgba(0,0,0,0.8)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(245,158,11,0.15)" }}>
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4" style={{ color: "#F59E0B" }} />
            <h2 className="font-bold text-white text-base">Report {targetUserName}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-white font-semibold">Report submitted.</p>
            <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>Our team will review it shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: "#F59E0B" }}>
                Reason
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map(r => (
                  <label key={r.value} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-amber-400"
                    />
                    <span className="text-sm text-white">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#9ca3af" }}>
                Additional details <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe what happened..."
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <p className="text-xs mt-0.5 text-right" style={{ color: "#6b7280" }}>{details.length}/500</p>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ background: "rgba(255,255,255,0.06)" }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !reason}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                style={{ background: "#F59E0B", color: "#000" }}
              >
                {loading ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

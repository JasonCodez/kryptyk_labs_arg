'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rarity, rarityColors } from '@/lib/rarity';
import { THEME_CONFIGS, FRAME_CONFIGS, type ThemeConfig } from '@/lib/profileThemes';
import AvatarFrame, { type FrameConfig } from '@/components/AvatarFrame';
import LoadingSpinner from '@/components/LoadingSpinner';

interface UserProfile {
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  totalPuzzlesSolved: number;
  totalPoints: number;
  rank: number | null;
  xp: number;
  level: number;
  xpTitle: string;
  xpToNextLevel: number;
  xpProgress: number;
  activeTheme: string;
  activeFrame: string;
  activeSkin: string;
  activeFlair: string;
  activeNameColor: string;
  activeTitle: string;
  isFounder: boolean;
}

// ─── Cosmetics Drawer ─────────────────────────────────────────────────────────
type DrawerItem = {
  key: string; name: string; subcategory: string; iconEmoji: string;
  metadata: Record<string, unknown> | null; owned: number; isExclusive?: boolean;
};

function normalizeSkinValue(value: string | null | undefined): string {
  if (!value) return '';
  return value === 'ice' || value === 'skin_ice' ? 'christmas' : value;
}

function getDrawerItemDisplayName(item: DrawerItem): string {
  if (item.subcategory !== 'skin') return item.name;
  const meta = item.metadata as { value?: string } | null;
  const skinValue = normalizeSkinValue(meta?.value ?? '');
  if (skinValue === 'christmas' || skinValue === 'skin_christmas') {
    if (/ice/i.test(item.name)) return item.name.replace(/ice/gi, 'Christmas');
    if (!/christmas/i.test(item.name)) return 'Christmas Skin';
  }
  return item.name;
}

function DrawerItemPreview({ item }: { item: DrawerItem }) {
  const meta = item.metadata as Record<string, string> | null;
  const sub = item.subcategory;

  if (sub === 'theme') {
    const p = meta?.primaryColor ?? '#FDE74C';
    const a = meta?.accentColor ?? '#FFB86B';
    return (
      <div className="rounded-lg h-10 mb-3 flex items-center px-3 gap-2 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${p}22, ${a}18, rgba(10,12,16,0.9))`, border: `1px solid ${p}33` }}>
        <div className="w-5 h-5 rounded-full shrink-0" style={{ background: `linear-gradient(135deg, ${p}, ${a})`, boxShadow: `0 0 6px ${p}66` }} />
        <div className="h-1.5 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${p}, ${a})` }} />
        <div className="flex gap-1 shrink-0">
          {[p, a].map((c, i) => <div key={i} className="w-3 h-3 rounded" style={{ backgroundColor: c }} />)}
        </div>
      </div>
    );
  }
  if (sub === 'frame') {
    const fs: Record<string, { ring: string; glow: string }> = {
      gold:  { ring: 'linear-gradient(135deg, #FDE74C, #FFB86B, #FDE74C)', glow: 'rgba(253,231,76,0.55)' },
      neon:  { ring: 'linear-gradient(135deg, #00FFFF, #CC00FF, #00FFFF)',  glow: 'rgba(0,255,255,0.45)' },
      flame: { ring: 'linear-gradient(135deg, #FF4500, #FDE74C, #FF4500)',  glow: 'rgba(255,69,0,0.55)' },
    };
    const f = fs[meta?.value ?? ''] ?? fs.gold;
    return (
      <div className="h-10 flex items-center gap-3 mb-3">
        <div className="relative w-8 h-8 shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
            style={{ border: `3px solid ${meta?.color ?? '#FDE74C'}`, boxShadow: `0 0 10px ${f.glow}`, background: '#0d1117' }}>
            👤
          </div>
        </div>
        <span className="text-xs text-white font-semibold opacity-75">{item.name}</span>
      </div>
    );
  }
  if (sub === 'flair') {
    const emoji = meta?.emoji ?? item.iconEmoji;
    return (
      <div className="h-10 flex items-center gap-2 mb-3 rounded-lg px-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs text-white font-semibold">PlayerName</span>
        <span className="text-base">{emoji}</span>
      </div>
    );
  }
  if (sub === 'name_color') {
    const val = meta?.value ?? '';
    const isRainbow = val === 'rainbow';
    return (
      <div className="h-10 flex items-center justify-center mb-3 rounded-lg px-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span
          className={isRainbow ? 'text-sm font-extrabold rainbow-name' : 'text-sm font-extrabold'}
          style={!isRainbow && val ? { color: val } : undefined}
        >
          PlayerName
        </span>
      </div>
    );
  }
  if (sub === 'skin') {
    type SkinDef = { bg: string; border: string; cell: string; cellGlow: string; alt: string; label: string; shadow: string };
    const skinDefs: Record<string, SkinDef> = {
      retro:   { bg: '#0a0020', border: '#B43CFF', cell: '#B43CFF',  cellGlow: 'rgba(180,60,255,0.7)', alt: '#120030', label: '#00FF88', shadow: '0 0 0 2px #B43CFF, 0 0 12px rgba(180,60,255,0.5)' },
      minimal: { bg: '#080808', border: 'rgba(255,255,255,0.12)', cell: 'rgba(255,255,255,0.55)', cellGlow: 'none', alt: 'rgba(255,255,255,0.05)', label: '#aaaaaa', shadow: 'none' },
      neon:    { bg: '#010012', border: '#00FFE5', cell: '#00FFE5',  cellGlow: 'rgba(0,255,229,0.8)', alt: 'rgba(0,255,229,0.06)', label: '#00FFE5', shadow: '0 0 0 2px #00FFE5, 0 0 12px rgba(0,255,229,0.55)' },
      lava:    { bg: '#060100', border: '#FF5500', cell: '#FF5500',  cellGlow: 'rgba(255,85,0,0.75)', alt: 'rgba(255,85,0,0.07)', label: '#FF9030', shadow: '0 0 0 2px #FF5500, 0 0 12px rgba(255,85,0,0.5)' },
      galaxy:  { bg: '#04001a', border: '#8B5CF6', cell: '#8B5CF6',  cellGlow: 'rgba(139,92,246,0.75)', alt: 'rgba(139,92,246,0.08)', label: '#D8B4FE', shadow: '0 0 0 2px #8B5CF6, 0 0 12px rgba(139,92,246,0.55)' },
      christmas: { bg: '#000d1f', border: '#67E8F9', cell: '#67E8F9',  cellGlow: 'rgba(103,232,249,0.7)', alt: 'rgba(103,232,249,0.06)', label: '#E0F9FF', shadow: '0 0 0 2px #67E8F9, 0 0 12px rgba(103,232,249,0.45)' },
      skin_christmas: { bg: '#000d1f', border: '#67E8F9', cell: '#67E8F9',  cellGlow: 'rgba(103,232,249,0.7)', alt: 'rgba(103,232,249,0.06)', label: '#E0F9FF', shadow: '0 0 0 2px #67E8F9, 0 0 12px rgba(103,232,249,0.45)' },
      ice:     { bg: '#000d1f', border: '#67E8F9', cell: '#67E8F9',  cellGlow: 'rgba(103,232,249,0.7)', alt: 'rgba(103,232,249,0.06)', label: '#E0F9FF', shadow: '0 0 0 2px #67E8F9, 0 0 12px rgba(103,232,249,0.45)' },
    };
    const normalizedSkinValue = normalizeSkinValue(meta?.value ?? '');
    const sd = skinDefs[normalizedSkinValue] ?? skinDefs.minimal;
    return (
      <div className="h-10 flex items-center justify-between px-3 mb-3 rounded-lg relative overflow-hidden"
        style={{ backgroundColor: sd.bg, border: `1px solid ${sd.border}55`, boxShadow: sd.shadow }}>
        <div className="flex gap-0.5">
          {[1,0,1,1,0,1,0,1].map((f, i) => (
            <div key={i} className="w-4 h-6 rounded-sm"
              style={{ backgroundColor: f ? sd.cell : sd.alt, border: `1px solid ${sd.border}44`, boxShadow: f ? `0 0 4px ${sd.cellGlow}` : 'none' }} />
          ))}
        </div>
        <span className="text-xs font-bold tracking-widest" style={{ color: sd.label, fontFamily: normalizedSkinValue === 'retro' || normalizedSkinValue === 'neon' ? "'Courier New', monospace" : 'inherit' }}>
          {normalizedSkinValue.replace(/^skin_/, '').toUpperCase()}
        </span>
      </div>
    );
  }
  return null;
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
  const [showMyPuzzles, setShowMyPuzzles] = useState(false);
  const [myPuzzles, setMyPuzzles] = useState<Array<any>>([]);
  const [myPuzzlesLoading, setMyPuzzlesLoading] = useState(false);

  const [showCosmeticsDrawer, setShowCosmeticsDrawer] = useState(false);
  const [drawerItems, setDrawerItems] = useState<DrawerItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'theme' | 'frame' | 'skin' | 'flair' | 'name_color' | 'exclusive' | 'title'>('theme');
  const [drawerEquipping, setDrawerEquipping] = useState<string | null>(null);
  const [drawerToast, setDrawerToast] = useState<string | null>(null);

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
      const response = await fetch('/api/user/profile', { cache: 'no-store' });
      const text = await response.text();
      if (!response.ok) {
        console.error('Profile fetch error:', response.status, text);
        setError('Failed to load profile');
        return;
      }
      let data: UserProfile;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Profile response not JSON:', text.slice(0, 500));
        setError('Failed to load profile');
        return;
      }
      setProfile(data);
      setFormData({ name: data.name || '', email: data.email || '' });
    } catch (error) {
      console.error('Profile fetch error:', (error as Error)?.message ?? String(error));
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

  const openCosmeticsDrawer = async () => {
    setShowCosmeticsDrawer(true);
    setDrawerLoading(true);
    try {
      const [storeRes, exclusiveRes] = await Promise.all([
        fetch('/api/store', { cache: 'no-store' }),
        fetch('/api/user/exclusive-cosmetics', { cache: 'no-store' }),
      ]);
      const storeData = storeRes.ok ? await storeRes.json() : { items: [] };
      const exclusiveData = exclusiveRes.ok ? await exclusiveRes.json() : { items: [] };

      const regularItems = (storeData.items ?? []).filter(
        (i: DrawerItem) => ['theme', 'frame', 'skin', 'flair', 'name_color'].includes(i.subcategory) && i.owned > 0
      );
      const exclusiveItems = (exclusiveData.items ?? []).map((i: DrawerItem) => ({ ...i, isExclusive: true }));
      setDrawerItems([...regularItems, ...exclusiveItems]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDrawerEquip = async (itemKey: string, subcategory: string, unequip: boolean) => {
    if (drawerEquipping) return;
    setDrawerEquipping(itemKey);
    try {
      const res = await fetch('/api/store/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: unequip ? `unequip_${subcategory}` : itemKey }),
      });
      if (res.ok) {
        setDrawerToast(unequip ? 'Unequipped!' : 'Equipped!');
        setTimeout(() => setDrawerToast(null), 2500);
        await fetchProfile();
      }
    } finally {
      setDrawerEquipping(null);
    }
  };

  if (status === 'loading' || loading) {
    return <LoadingSpinner size={180} />;
  }

  if (!session?.user) {
    return null;
  }

  const t = THEME_CONFIGS[profile?.activeTheme ?? 'default'] ?? THEME_CONFIGS.default;
  const frame = FRAME_CONFIGS[profile?.activeFrame ?? 'none'] ?? FRAME_CONFIGS.none;
  const flair = profile?.activeFlair && profile.activeFlair !== 'none' ? <span style={{ display: 'inline-block', transform: 'translateY(-4px)' }}> {profile.activeFlair}</span> : null;
  const btnStyle = t.btnPrimary.startsWith('linear')
    ? { background: t.btnPrimary, color: t.btnPrimaryText }
    : { backgroundColor: t.btnPrimary, color: t.btnPrimaryText };

  return (
    <main style={{ backgroundColor: t.pageBg, transition: 'background-color 0.4s ease' }} className="min-h-screen">

      {/* Theme accent bar - immediately visible color indicator at the very top */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-50" style={{ background: t.btnPrimary.startsWith('linear') ? t.btnPrimary : `linear-gradient(90deg, ${t.primary}, ${t.secondary})`, boxShadow: `0 0 12px ${t.avatarGlow}` }} />

      {/* Animated header */}
      <div className="pt-24 pb-20 px-4 relative overflow-hidden" style={{ background: t.headerGradient }}>
        {/* Decorative orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: t.headerParticle1, filter: 'blur(70px)', transform: 'translateY(-30%)' }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full pointer-events-none" style={{ background: t.headerParticle2, filter: 'blur(55px)', transform: 'translateY(30%)' }} />
        {/* Bottom border glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: t.btnPrimary.startsWith('linear') ? t.btnPrimary : `linear-gradient(90deg, transparent, ${t.primary}, transparent)`, opacity: 0.7 }} />
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-5">
            {/* Avatar with frame */}
            <div className="relative shrink-0">
              {frame.colorA ? (
                <AvatarFrame frame={frame as FrameConfig} size={80} pageBg={t.pageBg}>
                  {profile?.image
                    ? <img src={profile.image} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                    : <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: t.primaryMuted }}>👤</div>}
                </AvatarFrame>
              ) : (
                <div className="w-20 h-20 rounded-full overflow-hidden border-[3px]" style={{ borderColor: t.primary, boxShadow: `0 0 18px ${t.avatarGlow}, 0 0 40px ${t.avatarGlow}` }}>
                  {profile?.image
                    ? <img src={profile.image} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                    : <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: t.primaryMuted }}>👤</div>}
                </div>
              )}
            </div>
            <div className="flex-1 flex items-start justify-between gap-3">
              <div>
                <h1
                  className={`text-4xl font-extrabold mb-1 text-white${profile?.activeNameColor === 'rainbow' ? ' rainbow-name' : ''}`}
                  style={profile?.activeNameColor && profile.activeNameColor !== 'none' && profile.activeNameColor !== 'rainbow' ? { color: profile.activeNameColor } : undefined}
                >{profile?.name || 'Player'}{flair}</h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: t.primaryMuted, color: t.primary, border: `1px solid ${t.primary}`, boxShadow: `0 0 8px ${t.avatarGlow}` }}>
                    LVL {profile?.level ?? 1} &middot; {profile?.xpTitle ?? 'Newcomer'}
                  </span>
                  {profile?.activeTitle === 'founder' && (
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(253,231,76,0.12)', color: '#FDE74C', border: '1px solid rgba(253,231,76,0.4)', boxShadow: '0 0 8px rgba(253,231,76,0.25)' }}>
                      ⚜️ Founder
                    </span>
                  )}
                  {profile?.role === 'admin' && (
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(171,159,157,0.2)', color: '#c9b9b7' }}>Admin</span>
                  )}
                </div>
                <p className="text-sm mt-1" style={{ color: t.subtleText }}>Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' }) : '...'}</p>
              </div>
              <button
                onClick={openCosmeticsDrawer}
                title="My Cosmetics"
                className="mt-1 w-9 h-9 flex items-center justify-center rounded-full text-base transition-all hover:scale-110 shrink-0"
                style={{ backgroundColor: t.primaryMuted, border: `1px solid ${t.primaryBorder}`, color: t.primary }}
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-10 max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(171,159,157,0.15)', borderColor: '#AB9F9D' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl text-white border" style={{ backgroundColor: t.primaryMuted, borderColor: t.primary }}>
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Avatar Card */}
          <div className="border rounded-xl p-6" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}>
            <h3 className="text-lg font-bold text-white mb-6">Avatar</h3>
            <div className="flex flex-col items-center space-y-4">
              {/* Current Avatar with active frame */}
              {frame.colorA ? (
                <AvatarFrame frame={frame as FrameConfig} size={96} pageBg={t.pageBg}>
                  {profile?.image
                    ? <img src={profile.image} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                    : <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: t.primaryMuted }}>👤</div>}
                </AvatarFrame>
              ) : (
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 flex items-center justify-center" style={{ borderColor: t.avatarRing, boxShadow: `0 0 14px ${t.avatarGlow}` }}>
                  {profile?.image
                    ? <img src={profile.image} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                    : <span className="text-4xl">👤</span>}
                </div>
              )}

              {/* Avatar Preview */}
              {avatarPreview && (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2" style={{ borderColor: t.primaryBorder }}>
                  <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                </div>
              )}

              {/* File Input */}
              <label className="w-full">
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                <span className="block w-full px-4 py-2 rounded-lg text-center text-sm font-semibold transition cursor-pointer hover:opacity-90"
                  style={{ background: t.btnPrimary, color: t.btnPrimaryText } as React.CSSProperties}>
                  Choose Image
                </span>
              </label>

              {/* Upload Button */}
              {avatarFile && (
                <button
                  onClick={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: t.btnPrimary, color: t.btnPrimaryText } as React.CSSProperties}
                >
                  {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                </button>
              )}

              <p className="text-xs" style={{ color: t.subtleText }}>Max 5MB, JPG/PNG</p>
            </div>
          </div>

          {/* Profile Card */}
          <div className="md:col-span-2 md:row-span-2 border rounded-xl p-8" style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}>
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Account Information</h2>
              <button
                onClick={() => setEditing(!editing)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90"
                style={{ background: t.btnPrimary, color: t.btnPrimaryText } as React.CSSProperties}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: t.accentText }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border text-white"
                    style={{ backgroundColor: t.inputBg, borderColor: t.inputBorder }}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: t.accentText }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-2 rounded-lg border text-white opacity-50 cursor-not-allowed"
                    style={{ backgroundColor: t.inputBg, borderColor: t.inputBorder }}
                  />
                  <p className="text-xs mt-1" style={{ color: t.subtleText }}>Email cannot be changed</p>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-3 rounded-lg font-semibold transition hover:opacity-90"
                  style={{ background: t.btnPrimary, color: t.btnPrimaryText } as React.CSSProperties}
                >
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm mb-0.5" style={{ color: t.subtleText }}>Name</p>
                  <p className="text-lg font-semibold text-white">{profile?.name || 'Not set'}</p>
                </div>
                <div style={{ borderTopColor: `${t.primaryBorder}40`, borderTopWidth: 1, paddingTop: 16 }}>
                  <p className="text-sm mb-0.5" style={{ color: t.subtleText }}>Email</p>
                  <p className="text-lg font-semibold text-white">{profile?.email}</p>
                </div>
                <div style={{ borderTopColor: `${t.primaryBorder}40`, borderTopWidth: 1, paddingTop: 16 }}>
                  <p className="text-sm mb-0.5" style={{ color: t.subtleText }}>Role</p>
                  <span className="inline-block px-3 py-1 rounded text-sm font-semibold" style={{ backgroundColor: t.primaryMuted, color: t.primary, border: `1px solid ${t.primaryBorder}` }}>
                    {profile?.role === 'admin' ? '🛡️ Administrator' : '🎮 Player'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Stats Card */}
          <div className="border rounded-xl p-6 space-y-5" style={{ backgroundColor: t.statCardBg, borderColor: t.statCardBorder, boxShadow: t.cardGlow }}>
            <h3 className="text-lg font-bold text-white">Your Stats</h3>

            {/* Level badge */}
            <div className="flex flex-col items-center gap-1 py-4 rounded-xl" style={{ background: t.primaryMuted, border: `1px solid ${t.primaryBorder}` }}>
              <div className="text-5xl font-black" style={{ color: t.primary, textShadow: `0 0 20px ${t.primary}66` }}>
                {profile?.level ?? 1}
              </div>
              <div className="text-xs font-bold tracking-widest uppercase" style={{ color: t.secondary }}>
                {profile?.xpTitle ?? 'Newcomer'}
              </div>
            </div>

            {/* XP bar */}
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: t.subtleText }}>
                <span>{profile?.xp ?? 0} XP</span>
                <span>+{profile?.xpToNextLevel ?? 100} to next</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 7, background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, profile?.xpProgress ?? 0)}%`, background: t.xpBarGradient }} />
              </div>
            </div>

            {[
              { label: 'Puzzles Solved', value: profile?.totalPuzzlesSolved ?? 0 },
              { label: 'Total Points',   value: (profile?.totalPoints ?? 0).toLocaleString() },
              { label: 'Global Rank',    value: profile?.rank ? `#${profile.rank}` : 'Unranked' },
            ].map(({ label, value }) => (
              <div key={label} style={{ borderTopColor: `${t.primaryBorder}33`, borderTopWidth: 1, paddingTop: 12 }}>
                <p className="text-xs mb-0.5" style={{ color: t.subtleText }}>{label}</p>
                <p className="text-3xl font-extrabold" style={{ color: t.primary }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* My Puzzles */}
        <div className="mb-8">
          <div className="border rounded-xl p-6" style={{ backgroundColor: t.statCardBg, borderColor: t.statCardBorder, boxShadow: t.cardGlow }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">My Puzzles (Archive)</h3>
              <button
                onClick={async () => {
                  setShowMyPuzzles(!showMyPuzzles);
                  if (!showMyPuzzles && myPuzzles.length === 0) {
                    setMyPuzzlesLoading(true);
                    try {
                      const res = await fetch('/api/user/puzzles');
                      if (res.ok) setMyPuzzles(await res.json());
                    } catch (e) { console.error(e); }
                    finally { setMyPuzzlesLoading(false); }
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90"
                style={{ background: t.btnPrimary, color: t.btnPrimaryText } as React.CSSProperties}
              >
                {showMyPuzzles ? 'Hide' : 'Show'}
              </button>
            </div>
            {showMyPuzzles && (
              myPuzzlesLoading ? (
                <p className="text-sm" style={{ color: t.subtleText }}>Loading...</p>
              ) : myPuzzles.length === 0 ? (
                <p className="text-sm" style={{ color: t.subtleText }}>No archived puzzles yet.</p>
              ) : (
                <div className="space-y-3">
                  {myPuzzles.map((p) => (
                    <div key={p.id} className="border rounded-lg p-3" style={{ borderColor: t.cardBorder, backgroundColor: t.primaryMuted }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white text-sm">{p.title}</p>
                          <p className="text-xs" style={{ color: t.subtleText }}>{p.category?.name || 'General'} &middot; {p.difficulty}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs px-2 py-1 rounded font-semibold" style={{ backgroundColor: p.solved ? 'rgba(56,201,153,0.12)' : 'rgba(239,68,68,0.08)', color: p.solved ? '#38D399' : '#EF4444' }}>
                            {p.solved ? '✔ Solved' : '✘ Failed'}
                          </span>
                          <div className="text-xs mt-1" style={{ color: t.subtleText }}>{p.attempts ?? 0} attempts</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Unlocked Badges */}
        <div className="mb-8">
          <div className="border rounded-xl p-6" style={{ backgroundColor: t.statCardBg, borderColor: t.secondary, boxShadow: t.cardGlow }}>
            <h3 className="text-lg font-bold text-white mb-4">🏅 Unlocked Badges</h3>
            {badgesLoading ? (
              <p className="text-sm" style={{ color: t.subtleText }}>Loading badges...</p>
            ) : unlockedBadges.length === 0 ? (
              <p className="text-sm" style={{ color: t.subtleText }}>No badges unlocked yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {unlockedBadges.map((b) => {
                  const color = rarityColors[b.rarity] || rarityColors.common;
                  return (
                    <div key={b.id} className="flex flex-col items-center p-3 rounded-xl border" style={{ backgroundColor: color.bg, borderColor: t.primary }}>
                      <div className="text-3xl mb-2">{b.icon}</div>
                      <div className="text-sm font-semibold text-center" style={{ color: color.text }}>{b.title}</div>
                      {b.unlockedAt && <div className="text-xs mt-1" style={{ color: t.subtleText }}>{new Date(b.unlockedAt).toLocaleDateString()}</div>}
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
            className="border rounded-xl p-6 transition hover:scale-[1.02]"
            style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}
          >
            <h3 className="text-lg font-bold text-white mb-1">← Back to Dashboard</h3>
            <p style={{ color: t.subtleText }}>Return to your dashboard</p>
          </Link>
          <Link
            href="/store"
            className="border rounded-xl p-6 transition hover:scale-[1.02]"
            style={{ backgroundColor: t.primaryMuted, borderColor: t.primaryBorder }}
          >
            <h3 className="text-lg font-bold text-white mb-1">🛒 Point Store</h3>
            <p style={{ color: t.subtleText }}>Change your active theme, frame & flair</p>
          </Link>
        </div>
      </div>

      {/* ── Cosmetics Drawer ─────────────────────────────────────────────── */}
      {showCosmeticsDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCosmeticsDrawer(false)}
          />
          {/* Panel */}
          <div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xs flex flex-col"
            style={{ backgroundColor: t.pageBg, borderLeft: `1px solid ${t.primaryBorder}40`, boxShadow: '-12px 0 48px rgba(0,0,0,0.75)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: `${t.primaryBorder}33` }}>
              <div>
                <h2 className="font-extrabold text-white text-base">⚙️ My Cosmetics</h2>
                <p className="text-xs mt-0.5" style={{ color: t.subtleText }}>Equip items you own</p>
              </div>
              <button onClick={() => setShowCosmeticsDrawer(false)} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">✕</button>
            </div>

            {/* Toast */}
            {drawerToast && (
              <div className="mx-4 mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-center shrink-0"
                style={{ backgroundColor: t.primaryMuted, color: t.primary, border: `1px solid ${t.primaryBorder}` }}>
                {drawerToast}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0 flex-wrap">
              {(['theme', 'frame', 'skin', 'flair', 'name_color', 'exclusive', ...(profile?.isFounder ? ['title' as const] : [])] as const).map((tab) => {
                const icons: Record<string, string> = { theme: '🎨', frame: '🖼️', skin: '🎮', flair: '✨', name_color: '🌈', exclusive: '⭐', title: '⚜️' };
                const count = tab === 'exclusive'
                  ? drawerItems.filter(i => i.isExclusive).length
                  : tab === 'title'
                  ? (profile?.isFounder ? 1 : 0)
                  : drawerItems.filter(i => i.subcategory === tab && !i.isExclusive).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setDrawerTab(tab)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={drawerTab === tab
                      ? { backgroundColor: (tab === 'exclusive' || tab === 'title') ? 'rgba(253,231,76,0.12)' : t.primaryMuted, color: (tab === 'exclusive' || tab === 'title') ? '#FDE74C' : t.primary, border: `1px solid ${(tab === 'exclusive' || tab === 'title') ? 'rgba(253,231,76,0.4)' : t.primaryBorder}` }
                      : { color: t.subtleText, backgroundColor: 'transparent', border: '1px solid transparent' }}
                  >
                    {icons[tab]}{count > 0 && <span className="ml-0.5 opacity-60">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1 space-y-3">
              {drawerLoading && (
                <div className="text-center py-10 text-sm" style={{ color: t.subtleText }}>Loading…</div>
              )}

              {/* ── Founder title card ── */}
              {!drawerLoading && drawerTab === 'title' && profile?.isFounder && (() => {
                const equipped = profile.activeTitle === 'founder';
                return (
                  <div className="rounded-xl border p-4 transition-colors"
                    style={{ backgroundColor: equipped ? 'rgba(253,231,76,0.08)' : t.cardBg, borderColor: equipped ? 'rgba(253,231,76,0.4)' : `${t.primaryBorder}30` }}>
                    <div className="h-10 flex items-center gap-2 mb-3 rounded-lg px-3"
                      style={{ background: 'rgba(253,231,76,0.08)', border: '1px solid rgba(253,231,76,0.2)' }}>
                      <span className="text-base">⚜️</span>
                      <span className="text-sm font-extrabold" style={{ color: '#FDE74C' }}>Founder</span>
                      <span className="text-xs ml-1 px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(253,231,76,0.15)', color: '#FDE74C' }}>#1–1000</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">Founder</p>
                        <p className="text-xs" style={{ color: t.subtleText }}>One of the first 1,000 members</p>
                        {equipped && <p className="text-xs font-bold mt-0.5" style={{ color: '#FDE74C' }}>● Equipped</p>}
                      </div>
                      <button
                        onClick={() => handleDrawerEquip('equip_founder_title', 'title', equipped)}
                        disabled={!!drawerEquipping}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 hover:opacity-90"
                        style={{ background: equipped ? 'rgba(255,255,255,0.08)' : 'rgba(253,231,76,0.15)', color: equipped ? t.subtleText : '#FDE74C', border: `1px solid ${equipped ? 'transparent' : 'rgba(253,231,76,0.3)'}` }}
                      >
                        {drawerEquipping === 'equip_founder_title' ? '…' : equipped ? 'Unequip' : 'Equip'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {!drawerLoading && drawerTab !== 'title' && (() => {
                const filtered = drawerTab === 'exclusive'
                  ? drawerItems.filter(i => i.isExclusive)
                  : drawerItems.filter(i => i.subcategory === drawerTab && !i.isExclusive);
                return filtered.length === 0 ? (
                  <div className="text-center py-10">
                    {drawerTab === 'exclusive' ? (
                      <>
                        <p className="text-2xl mb-2">⭐</p>
                        <p className="text-sm font-semibold text-white/70">No exclusive items yet.</p>
                        <p className="text-xs mt-1" style={{ color: t.subtleText }}>Earn them by completing Season Pass tiers.</p>
                        <a href="/season-pass" className="text-xs mt-2 inline-block underline" style={{ color: '#FDE74C' }}>View Season Pass →</a>
                      </>
                    ) : (
                      <>
                        <p className="text-sm" style={{ color: t.subtleText }}>No {drawerTab}s owned yet.</p>
                        <a href="/store" className="text-xs mt-2 inline-block underline" style={{ color: t.primary }}>Browse the store →</a>
                      </>
                    )}
                  </div>
                ) : null;
              })()}
              {!drawerLoading && drawerTab !== 'title' && (drawerTab === 'exclusive'
                ? drawerItems.filter(i => i.isExclusive)
                : drawerItems.filter(i => i.subcategory === drawerTab && !i.isExclusive)
              ).map(item => {
                const meta = item.metadata as Record<string, string> | null;
                const equipped = (() => {
                  if (!profile) return false;
                  const value = item.subcategory === 'flair'
                    ? (meta?.emoji ?? meta?.value ?? item.key)
                    : (meta?.value ?? item.key);
                  if (item.subcategory === 'theme') return profile.activeTheme === value;
                  if (item.subcategory === 'frame') return profile.activeFrame === value;
                  if (item.subcategory === 'skin')  return profile.activeSkin  === value;
                  if (item.subcategory === 'flair') return profile.activeFlair === value;
                  if (item.subcategory === 'name_color') return profile.activeNameColor === value;
                  return false;
                })();
                return (
                  <div key={item.key} className="rounded-xl border p-4 transition-colors"
                    style={{ backgroundColor: equipped ? t.primaryMuted : t.cardBg, borderColor: equipped ? t.primaryBorder : `${t.primaryBorder}30` }}>
                    <DrawerItemPreview item={item} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{getDrawerItemDisplayName(item)}</p>
                        {equipped && <p className="text-xs font-bold" style={{ color: t.primary }}>● Equipped</p>}
                      </div>
                      <button
                        onClick={() => handleDrawerEquip(item.key, item.subcategory, equipped)}
                        disabled={!!drawerEquipping}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 hover:opacity-90"
                        style={{ background: equipped ? 'rgba(255,255,255,0.08)' : t.btnPrimary, color: equipped ? t.subtleText : t.btnPrimaryText } as React.CSSProperties}
                      >
                        {drawerEquipping === item.key ? '…' : equipped ? 'Unequip' : 'Equip'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
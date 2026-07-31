'use client';

/**
 * ProfileIdentityProgress — the top-of-profile identity/progression hero.
 *
 * Purely presentational: it owns no data fetching, no mutation, no modal or
 * edit state. The parent page passes in already-fetched profile data, the
 * active theme/frame configs, and callbacks for the actions it exposes.
 */

import { useEffect, useState } from "react";
import { Pencil, Sparkles, Users, UserPlus, Trophy, CheckCircle2, Coins } from "lucide-react";
import AvatarFrame, { type FrameConfig } from "@/components/AvatarFrame";
import type { ThemeConfig } from "@/lib/profileThemes";
import type { Rarity } from "@/lib/rarity";

// Matches the shape of an entry in `FRAME_CONFIGS` (colorA/colorB are only
// present for frames that actually render a ring — "none" has neither).
export type ProfileFrameConfig = {
  ring: string;
  glow: string;
  colorA?: string;
  colorB?: string;
  rarity?: Rarity;
};

export interface ProfileIdentityProgressProfile {
  name: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  level: number;
  xp: number;
  xpTitle: string;
  xpToNextLevel: number;
  xpProgress: number;
  totalPuzzlesSolved: number;
  totalPoints: number;
  rank: number | null;
  activeNameColor: string;
  activeFlair: string;
  activeTitle: string;
  isFounder: boolean;
  social: {
    followers: number;
    following: number;
  };
}

export interface ProfileIdentityProgressProps {
  profile: ProfileIdentityProgressProfile;
  theme: ThemeConfig;
  frame: ProfileFrameConfig;
  onEditProfile: () => void;
  onCustomize: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatMemberSince(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "long" });
}

export default function ProfileIdentityProgress({
  profile,
  theme: t,
  frame,
  onEditProfile,
  onCustomize,
  onOpenFollowers,
  onOpenFollowing,
}: ProfileIdentityProgressProps) {
  // Avatar/frame size is JS-driven (not CSS-only) because AvatarFrame computes
  // ring geometry from a fixed pixel `size` prop — mirrors the isDesktopLayout
  // pattern already used elsewhere in this codebase for viewport-aware sizing.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const avatarSize = isDesktop ? 112 : 92;

  const displayName = profile.name || "Player";
  const isRainbowName = profile.activeNameColor === "rainbow";
  const nameStyle =
    profile.activeNameColor && profile.activeNameColor !== "none" && profile.activeNameColor !== "rainbow"
      ? { color: profile.activeNameColor }
      : undefined;
  const flair =
    profile.activeFlair && profile.activeFlair !== "none" ? (
      <span style={{ display: "inline-block", transform: "translateY(-4px)" }}> {profile.activeFlair}</span>
    ) : null;

  const clampedProgress = clampProgress(profile.xpProgress);
  const hasFrame = Boolean(frame.colorA);

  const avatarNode = profile.image ? (
    <img
      src={profile.image}
      alt={profile.name ? `${profile.name}'s avatar` : "Profile avatar"}
      className="w-full h-full object-cover"
      onError={(e) => {
        const img = e.currentTarget;
        img.onerror = null;
        img.src = "/images/default-avatar.svg";
      }}
    />
  ) : (
    <div
      className="w-full h-full flex items-center justify-center text-3xl"
      style={{ background: t.primaryMuted }}
      role="img"
      aria-label={profile.name ? `${profile.name}'s avatar` : "Profile avatar"}
    >
      👤
    </div>
  );

  const statTiles = [
    {
      key: "rank",
      label: "Global Rank",
      value: profile.rank ? `#${profile.rank}` : "Unranked",
      Icon: Trophy,
    },
    {
      key: "solved",
      label: "Puzzles Solved",
      value: profile.totalPuzzlesSolved.toLocaleString(),
      Icon: CheckCircle2,
    },
    {
      key: "points",
      label: "Earned Points",
      value: profile.totalPoints.toLocaleString(),
      Icon: Coins,
    },
  ];

  return (
    <section
      aria-label="Player profile"
      className="max-w-5xl mx-auto rounded-3xl border px-5 py-8 sm:px-8 sm:py-10"
      style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardGlow }}
    >
      <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left md:gap-8">
        {/* Avatar */}
        <div className="shrink-0">
          {hasFrame ? (
            <AvatarFrame frame={frame as FrameConfig} size={avatarSize} pageBg={t.pageBg}>
              {avatarNode}
            </AvatarFrame>
          ) : (
            <div
              className="rounded-full overflow-hidden border-[3px]"
              style={{
                width: avatarSize,
                height: avatarSize,
                borderColor: t.primary,
                boxShadow: `0 0 18px ${t.avatarGlow}, 0 0 40px ${t.avatarGlow}`,
              }}
            >
              {avatarNode}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="mt-5 md:mt-0 flex-1 min-w-0 flex flex-col items-center md:items-start">
          <h1
            className={`text-3xl sm:text-4xl font-extrabold text-white break-words${isRainbowName ? " rainbow-name" : ""}`}
            style={nameStyle}
          >
            {displayName}
            {flair}
          </h1>

          <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mt-2">
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: t.primaryMuted,
                color: t.primary,
                border: `1px solid ${t.primary}`,
                boxShadow: `0 0 8px ${t.avatarGlow}`,
              }}
            >
              LVL {profile.level} &middot; {profile.xpTitle}
            </span>
            {profile.activeTitle === "founder" && (
              <span
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{
                  backgroundColor: "rgba(255,201,60,0.12)",
                  color: "#FFC93C",
                  border: "1px solid rgba(255,201,60,0.4)",
                  boxShadow: "0 0 8px rgba(255,201,60,0.25)",
                }}
              >
                ⚜️ Founder
              </span>
            )}
            {profile.role === "admin" && (
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: "rgba(171,159,157,0.2)", color: "#c9b9b7" }}
              >
                Admin
              </span>
            )}
          </div>

          <p className="text-sm mt-2" style={{ color: t.subtleText }}>
            Member since {formatMemberSince(profile.createdAt)}
          </p>

          {/* Primary actions */}
          <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap mt-4">
            <button
              type="button"
              onClick={onEditProfile}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: t.btnPrimary, color: t.btnPrimaryText } as React.CSSProperties}
            >
              <Pencil size={16} aria-hidden="true" />
              Edit Profile
            </button>
            <button
              type="button"
              onClick={onCustomize}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: t.primaryMuted, color: t.primary, border: `1px solid ${t.primaryBorder}` }}
            >
              <Sparkles size={16} aria-hidden="true" />
              Customize
            </button>
          </div>

          {/* Social counts */}
          <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
            <button
              type="button"
              onClick={onOpenFollowers}
              className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: t.primaryMuted, border: `1px solid ${t.primaryBorder}` }}
            >
              <Users size={16} style={{ color: t.primary }} aria-hidden="true" />
              <span className="font-bold text-white">{profile.social.followers}</span>
              <span style={{ color: t.subtleText }}>Followers</span>
            </button>
            <button
              type="button"
              onClick={onOpenFollowing}
              className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: t.primaryMuted, border: `1px solid ${t.primaryBorder}` }}
            >
              <UserPlus size={16} style={{ color: t.primary }} aria-hidden="true" />
              <span className="font-bold text-white">{profile.social.following}</span>
              <span style={{ color: t.subtleText }}>Following</span>
            </button>
          </div>
        </div>
      </div>

      {/* XP progress */}
      <div className="mt-8">
        <div className="flex justify-between text-xs mb-1.5" style={{ color: t.subtleText }}>
          <span>{profile.xp.toLocaleString()} XP</span>
          <span>+{profile.xpToNextLevel.toLocaleString()} to next level</span>
        </div>
        <div
          role="progressbar"
          aria-label="Level progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedProgress}
          className="w-full rounded-full overflow-hidden"
          style={{ height: 9, background: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${clampedProgress}%`, background: t.xpBarGradient }}
          />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-8">
        {statTiles.map(({ key, label, value, Icon }) => (
          <div
            key={key}
            className="rounded-2xl border px-3 py-4 sm:px-4 sm:py-5 flex flex-col items-center text-center gap-1"
            style={{ backgroundColor: t.statCardBg, borderColor: t.statCardBorder }}
          >
            <Icon size={20} style={{ color: t.primary }} aria-hidden="true" />
            <p className="text-lg sm:text-2xl font-extrabold text-white break-words">{value}</p>
            <p className="text-xs" style={{ color: t.subtleText }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

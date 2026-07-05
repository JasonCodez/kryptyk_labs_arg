import type { Rarity } from "@/lib/rarity";

export interface ThemeConfig {
  pageBg: string;
  headerGradient: string;
  headerParticle1: string;
  headerParticle2: string;
  primary: string;
  primaryMuted: string;
  primaryBorder: string;
  secondary: string;
  cardBg: string;
  cardBorder: string;
  statCardBg: string;
  statCardBorder: string;
  accentText: string;
  subtleText: string;
  inputBg: string;
  inputBorder: string;
  btnPrimary: string;
  btnPrimaryText: string;
  xpBarGradient: string;
  avatarRing: string;
  avatarGlow: string;
  cardGlow: string;
}

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
  default: {
    pageBg: '#020202',
    headerGradient: 'linear-gradient(135deg, rgba(56,145,166,0.25) 0%, rgba(56,145,166,0.10) 50%, rgba(253,231,76,0.06) 100%)',
    headerParticle1: 'rgba(56,145,166,0.25)',
    headerParticle2: 'rgba(253,231,76,0.12)',
    primary: '#3891A6',
    primaryMuted: 'rgba(56,145,166,0.18)',
    primaryBorder: '#3891A6',
    secondary: '#FDE74C',
    cardBg: 'rgba(56,145,166,0.12)',
    cardBorder: '#3891A6',
    statCardBg: 'rgba(56,145,166,0.10)',
    statCardBorder: 'rgba(56,145,166,0.6)',
    accentText: '#FDE74C',
    subtleText: '#AB9F9D',
    inputBg: 'rgba(0,0,0,0.5)',
    inputBorder: '#3891A6',
    btnPrimary: '#3891A6',
    btnPrimaryText: '#fff',
    xpBarGradient: 'linear-gradient(90deg, #3891A6, #38D399)',
    avatarRing: '#3891A6',
    avatarGlow: 'rgba(56,145,166,0)',
    cardGlow: 'none',
  },
  gold: {
    pageBg: '#0d0900',
    headerGradient: 'linear-gradient(135deg, #2a1a00 0%, #1a1000 50%, #0d0900 100%)',
    headerParticle1: 'rgba(253,231,76,0.35)',
    headerParticle2: 'rgba(255,184,107,0.25)',
    primary: '#FDE74C',
    primaryMuted: 'rgba(253,231,76,0.18)',
    primaryBorder: '#FDE74C',
    secondary: '#FFB86B',
    cardBg: 'rgba(253,231,76,0.08)',
    cardBorder: '#FDE74C',
    statCardBg: 'rgba(255,184,107,0.10)',
    statCardBorder: '#FFB86B',
    accentText: '#FDE74C',
    subtleText: '#c9a84c',
    inputBg: 'rgba(30,20,0,0.7)',
    inputBorder: '#FDE74C',
    btnPrimary: 'linear-gradient(135deg, #FDE74C, #FFB86B)',
    btnPrimaryText: '#1a1000',
    xpBarGradient: 'linear-gradient(90deg, #FDE74C, #FFB86B)',
    avatarRing: '#FDE74C',
    avatarGlow: 'rgba(253,231,76,0.8)',
    cardGlow: 'none',
  },
  neon: {
    pageBg: '#04000e',
    headerGradient: 'linear-gradient(135deg, #0a0020 0%, #00FFFF12 25%, #04000e 50%, #CC00FF10 75%, #000a12 100%)',
    headerParticle1: 'rgba(0,255,255,0.35)',
    headerParticle2: 'rgba(204,0,255,0.30)',
    primary: '#00FFFF',
    primaryMuted: 'rgba(0,255,255,0.15)',
    primaryBorder: '#00FFFF',
    secondary: '#CC00FF',
    cardBg: 'rgba(0,255,255,0.07)',
    cardBorder: '#00FFFF',
    statCardBg: 'rgba(204,0,255,0.08)',
    statCardBorder: '#CC00FF',
    accentText: '#00FFFF',
    subtleText: '#8ab8bb',
    inputBg: 'rgba(0,5,20,0.85)',
    inputBorder: '#00FFFF',
    btnPrimary: 'linear-gradient(135deg, #00FFFF, #CC00FF)',
    btnPrimaryText: '#000',
    xpBarGradient: 'linear-gradient(90deg, #00FFFF, #CC00FF)',
    avatarRing: '#00FFFF',
    avatarGlow: 'rgba(0,255,255,0.9)',
    cardGlow: '0 0 15px rgba(0,255,255,0.4), 0 0 30px rgba(0,255,255,0.15), 0 0 5px rgba(204,0,255,0.3)',
  },
  crimson: {
    pageBg: '#0e0000',
    headerGradient: 'linear-gradient(135deg, #2d0000 0%, #1a0000 50%, #0e0000 100%)',
    headerParticle1: 'rgba(220,38,38,0.40)',
    headerParticle2: 'rgba(249,115,22,0.28)',
    primary: '#ef4444',
    primaryMuted: 'rgba(220,38,38,0.18)',
    primaryBorder: '#ef4444',
    secondary: '#F97316',
    cardBg: 'rgba(220,38,38,0.10)',
    cardBorder: '#ef4444',
    statCardBg: 'rgba(249,115,22,0.08)',
    statCardBorder: '#F97316',
    accentText: '#ef4444',
    subtleText: '#b87070',
    inputBg: 'rgba(30,0,0,0.75)',
    inputBorder: '#ef4444',
    btnPrimary: 'linear-gradient(135deg, #DC2626, #F97316)',
    btnPrimaryText: '#fff',
    xpBarGradient: 'linear-gradient(90deg, #DC2626, #F97316)',
    avatarRing: '#DC2626',
    avatarGlow: 'rgba(220,38,38,0.85)',
    cardGlow: 'none',
  },
  // ── Season 1: Ignition exclusive themes ──
  ignition_ember: {
    pageBg: '#0a0400',
    headerGradient: 'linear-gradient(135deg, #3b1200 0%, #1a0800 50%, #0a0400 100%)',
    headerParticle1: 'rgba(251,146,60,0.40)',
    headerParticle2: 'rgba(234,88,12,0.30)',
    primary: '#FB923C',
    primaryMuted: 'rgba(251,146,60,0.18)',
    primaryBorder: '#FB923C',
    secondary: '#EA580C',
    cardBg: 'rgba(251,146,60,0.10)',
    cardBorder: '#FB923C',
    statCardBg: 'rgba(234,88,12,0.08)',
    statCardBorder: '#EA580C',
    accentText: '#FB923C',
    subtleText: '#c48a5c',
    inputBg: 'rgba(20,8,0,0.75)',
    inputBorder: '#FB923C',
    btnPrimary: 'linear-gradient(135deg, #FB923C, #EA580C)',
    btnPrimaryText: '#1a0800',
    xpBarGradient: 'linear-gradient(90deg, #FB923C, #EA580C)',
    avatarRing: '#FB923C',
    avatarGlow: 'rgba(251,146,60,0.85)',
    cardGlow: 'none',
  },
  ignition_inferno: {
    pageBg: '#0c0004',
    headerGradient: 'linear-gradient(135deg, #3b0010 0%, #1c0008 50%, #0c0004 100%)',
    headerParticle1: 'rgba(255,50,50,0.45)',
    headerParticle2: 'rgba(255,170,0,0.35)',
    primary: '#FF3232',
    primaryMuted: 'rgba(255,50,50,0.20)',
    primaryBorder: '#FF3232',
    secondary: '#FFAA00',
    cardBg: 'rgba(255,50,50,0.10)',
    cardBorder: '#FF3232',
    statCardBg: 'rgba(255,170,0,0.08)',
    statCardBorder: '#FFAA00',
    accentText: '#FFAA00',
    subtleText: '#c97050',
    inputBg: 'rgba(25,0,5,0.80)',
    inputBorder: '#FF3232',
    btnPrimary: 'linear-gradient(135deg, #FF3232, #FFAA00)',
    btnPrimaryText: '#1c0008',
    xpBarGradient: 'linear-gradient(90deg, #FF3232, #FFAA00)',
    avatarRing: '#FF3232',
    avatarGlow: 'rgba(255,50,50,0.9)',
    cardGlow: 'none',
  },
};

export const FRAME_CONFIGS: Record<string, { ring: string; glow: string; colorA?: string; colorB?: string; rarity?: Rarity }> = {
  none:  { ring: '', glow: '' },
  gold:  { ring: 'linear-gradient(135deg, #FDE74C, #FFB86B, #FDE74C)', glow: '0 0 20px rgba(253,231,76,0.7), 0 0 40px rgba(253,231,76,0.3)', colorA: '#FDE74C', colorB: '#FFB86B' },
  neon:  { ring: 'linear-gradient(135deg, #00FFFF, #CC00FF, #00FFFF)',  glow: '0 0 20px rgba(0,255,255,0.7), 0 0 40px rgba(204,0,255,0.4)', colorA: '#00FFFF', colorB: '#CC00FF' },
  flame: { ring: 'linear-gradient(135deg, #FF4500, #FDE74C, #FF4500)',  glow: '0 0 20px rgba(255,69,0,0.8), 0 0 40px rgba(253,231,76,0.4)', colorA: '#FF4500', colorB: '#FDE74C' },
  // ── Season 1: Ignition exclusive frames — rarity drives the AvatarFrame effect tier ──
  ignition_bronze:    { ring: 'linear-gradient(135deg, #CD7F32, #E8A862, #CD7F32)', glow: '0 0 18px rgba(205,127,50,0.7), 0 0 36px rgba(205,127,50,0.3)', colorA: '#CD7F32', colorB: '#E8A862', rarity: 'common' },
  ignition_silver:    { ring: 'linear-gradient(135deg, #C0C0C0, #E8E8E8, #C0C0C0)', glow: '0 0 18px rgba(192,192,192,0.7), 0 0 36px rgba(192,192,192,0.3)', colorA: '#C0C0C0', colorB: '#E8E8E8', rarity: 'rare' },
  ignition_gold:      { ring: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)', glow: '0 0 22px rgba(255,215,0,0.8), 0 0 44px rgba(255,165,0,0.4)', colorA: '#FFD700', colorB: '#FFA500', rarity: 'epic' },
  ignition_legendary: { ring: 'linear-gradient(135deg, #FF3232, #FFAA00, #FF3232)', glow: '0 0 25px rgba(255,50,50,0.9), 0 0 50px rgba(255,170,0,0.5)', colorA: '#FF3232', colorB: '#FFAA00', rarity: 'legendary' },
  // ── Slot machine exclusive frames ──
  jackpot_platinum: { ring: 'linear-gradient(135deg, #E5E4E2, #FFD700, #E5E4E2)', glow: '0 0 22px rgba(229,228,226,0.8), 0 0 44px rgba(255,215,0,0.35)', colorA: '#E5E4E2', colorB: '#FFD700', rarity: 'epic' },
  jackpot_diamond:  { ring: 'linear-gradient(135deg, #B9F2FF, #7DF9FF, #B9F2FF)', glow: '0 0 25px rgba(185,242,255,0.9), 0 0 55px rgba(125,249,255,0.4)', colorA: '#B9F2FF', colorB: '#7DF9FF', rarity: 'legendary' },
};

/** Resolve theme key — handles both "gold" and "theme_gold" stored formats */
export function resolveThemeKey(activeTheme: string | undefined | null): string {
  return (activeTheme || 'default').replace(/^theme_/, '');
}

/** Get ThemeConfig by stored activeTheme value */
export function getThemeConfig(activeTheme: string | undefined | null): ThemeConfig {
  return THEME_CONFIGS[resolveThemeKey(activeTheme)] ?? THEME_CONFIGS.default;
}

/** Compute the top accent bar gradient from a ThemeConfig */
export function getTopBarGradient(t: ThemeConfig): string {
  return t.btnPrimary.startsWith('linear')
    ? t.btnPrimary
    : `linear-gradient(90deg, ${t.primary}, ${t.secondary})`;
}

/** Compute button style (background vs backgroundColor depending on gradient) */
export function getBtnStyle(t: ThemeConfig): React.CSSProperties {
  return t.btnPrimary.startsWith('linear')
    ? { background: t.btnPrimary, color: t.btnPrimaryText }
    : { backgroundColor: t.btnPrimary, color: t.btnPrimaryText };
}

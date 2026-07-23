import { ImageResponse } from 'next/og';

export const alt = 'PuzzleWarz — Crack Today\'s Gridlock File';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#010101',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background dot grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,208,0,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            opacity: 0.06,
            display: 'flex',
          }}
        />
        {/* Gold glow orb */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: '50%',
            marginLeft: -400,
            width: 800,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,208,0,0.18) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* FILE badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 18px',
            borderRadius: 999,
            border: '1px solid rgba(255,208,0,0.35)',
            background: 'rgba(255,208,0,0.08)',
            marginBottom: 28,
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFD700', display: 'flex' }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFD700' }}>
            Daily Puzzle · Arc System · Free to Play
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: 96, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 }}>
            GRIDLOCK
          </span>
          <span
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              background: 'linear-gradient(90deg, #FFD700 0%, #fffbe6 50%, #FFD700 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            FILE
          </span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 22, color: '#9CA3AF', marginTop: 24, letterSpacing: '0.02em', display: 'flex' }}>
          Find the hidden rule. Solve the grid. See where you rank.
        </div>

        {/* Bottom brand strip */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 48px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFD700' }}>
            PUZZLEWARZ.COM
          </span>
          <span style={{ fontSize: 14, color: '#4B5563', letterSpacing: '0.06em' }}>
            Train your mind. Earn your rank.
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}

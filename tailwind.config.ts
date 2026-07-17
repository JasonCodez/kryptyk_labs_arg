import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          // Base surfaces
          'ink': '#0B0E1A',
          'ink-2': '#0E1220',
          'surface': '#131829',
          'surface-hi': '#1C2340',
          // Accents — one job each
          'gold': '#FFC94A',      // earned / XP / claimed / premium
          'gold-dim': '#AD8932',
          'violet': '#B24BF3',    // rare / next-up / identity
          'violet-dim': '#7933A5',
          'teal': '#3D7FFF',      // primary action / info
          'success': '#2ED991',   // solved (the one green)
          'ember': '#FF3B5C',     // failed / danger
          'locked': '#454E68',
          // Text
          'text': '#EEF1FA',
          'text-dim': '#8891AC',
          'text-faint': '#5B6483',
          // Legacy aliases kept for any lingering references
          'dark': '#0B0E1A',
          'yellow': '#FFC94A',
          'light': '#DDDBF1',
          'accent': '#AB9F9D',
        },
        // "Casual Cartoon Skeuomorphism" palette for game-ui/* components — separate
        // namespace from `brand` so it never collides with the app's own dark theme.
        'candy': {
          'pink': '#FF4FA3',
          'pink-dim': '#C7157A',
          'purple': '#8B3DFF',
          'purple-dim': '#5B1FB0',
          'gold': '#FFC93C',
          'gold-dim': '#E0960B',
          'cyan': '#2FE6E0',
          'cyan-dim': '#0FA6A1',
          'ember': '#FF5A5A',
          'grass': '#3ED97A',
        },
      },
      boxShadow: {
        // Layered "pressable plastic/jelly" depth — bottom shadow for lift, inset top
        // highlight for the glossy light-hitting-a-3D-object look, inset bottom shadow
        // to ground the object so it doesn't look like it's floating.
        'skeu-raised': '0 6px 0 rgba(0,0,0,0.28), 0 10px 18px rgba(0,0,0,0.35), inset 0 3px 0 rgba(255,255,255,0.55), inset 0 -4px 8px rgba(0,0,0,0.18)',
        'skeu-raised-sm': '0 4px 0 rgba(0,0,0,0.28), 0 6px 10px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.16)',
        // Pressed state: the bottom "lift" shadow collapses to near-zero and the inset
        // flips to read as a dent, not a bump.
        'skeu-pressed': '0 1px 0 rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.25), inset 0 3px 6px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.12)',
        'skeu-panel': '0 12px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.12)',
        'skeu-pill': '0 3px 0 rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 5px rgba(0,0,0,0.15)',
      },
      fontFamily: {
        // "Casual Cartoon Skeuomorphism" typography — loaded via next/font/google
        // in src/app/layout.tsx (Baloo 2 / Nunito), consumed by JuicyText.tsx.
        display: ['var(--font-display)', 'ui-rounded', 'sans-serif'],
        ui: ['var(--font-ui)', 'ui-rounded', 'sans-serif'],
      },
      keyframes: {
        'candy-breathe': {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.045)', filter: 'brightness(1.12)' },
        },
        'candy-spark': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,201,60,0.55)' },
          '50%': { boxShadow: '0 0 0 10px rgba(255,201,60,0)' },
        },
      },
      animation: {
        'candy-breathe': 'candy-breathe 1.8s ease-in-out infinite',
        'candy-spark': 'candy-spark 1.6s ease-out infinite',
      },
    },
    screens: {
      'nav': '1032px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
};

export default config;

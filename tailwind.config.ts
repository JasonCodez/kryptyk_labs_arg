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

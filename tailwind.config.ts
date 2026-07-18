import type { Config } from 'tailwindcss';

// NOTE (Phase 8.1): this config is NOT wired into the Tailwind v4 compiler —
// there is no @config directive in globals.css, so nothing in `theme` here ever
// generated utilities. The color palette, skeu shadows, candy animations, and
// display/ui font faces that used to be duplicated here now live canonically in
// src/app/globals.css (`:root` brand tokens + the `@theme` block), where they
// actually compile. Only the content globs and the custom screen list are kept
// for reference / a future opt-in via @config.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
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

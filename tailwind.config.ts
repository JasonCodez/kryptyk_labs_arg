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
          'teal': '#3891A6',
          'dark': '#020202',
          'yellow': '#FDE74C',
          'light': '#DDDBF1',
          'accent': '#AB9F9D',
        },
      },
    },
  },
  plugins: [],
};

export default config;

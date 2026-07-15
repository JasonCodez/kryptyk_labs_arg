'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pw_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="pw-cookie-banner fixed left-0 right-0 z-50 flex items-center justify-between gap-4 bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-3 sm:px-6"
    >
      <p className="text-sm text-gray-300 leading-snug">
        🍪 We use cookies to keep you logged in, save your streak, and remember
        your preferences. By continuing to play you accept our use of cookies.{' '}
        <a
          href="/privacy"
          className="underline text-gray-400 hover:text-white transition-colors"
        >
          Learn more
        </a>
      </p>
      <button
        onClick={accept}
        className="shrink-0 rounded-md bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-1.5 text-sm font-medium text-white transition-colors"
      >
        Got it
      </button>
    </div>
  );
}

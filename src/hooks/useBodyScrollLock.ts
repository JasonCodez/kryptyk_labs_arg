"use client";

import { useEffect } from "react";

// Reference-counted so multiple modals can be mounted at once without one's
// unmount prematurely re-enabling scroll while another is still open.
let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyle: {
  position: string; top: string; left: string; right: string; width: string; overflow: string;
} | null = null;

// Locks background scroll (and iOS Safari's rubber-band scroll-through) while a
// full-screen modal is mounted. Pass `active=false` to opt out conditionally.
export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    lockCount += 1;
    if (lockCount === 1) {
      savedScrollY = window.scrollY;
      const body = document.body;
      savedBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
      };
      body.style.position = "fixed";
      body.style.top = `-${savedScrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0 && savedBodyStyle) {
        const body = document.body;
        body.style.position = savedBodyStyle.position;
        body.style.top = savedBodyStyle.top;
        body.style.left = savedBodyStyle.left;
        body.style.right = savedBodyStyle.right;
        body.style.width = savedBodyStyle.width;
        body.style.overflow = savedBodyStyle.overflow;
        window.scrollTo(0, savedScrollY);
        savedBodyStyle = null;
      }
    };
  }, [active]);
}

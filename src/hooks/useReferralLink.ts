"use client";

import { useEffect, useState } from "react";

type ReferralResponse = {
  link?: string;
};

// Fetches (and lazily creates, server-side) the current user's referral invite link,
// so share/result flows can carry it instead of a generic URL.
export function useReferralLink(enabled: boolean): string | undefined {
  const [link, setLink] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setLink(undefined);
      return;
    }

    let ignore = false;
    fetch("/api/user/referral")
      .then((res) => (res.ok ? (res.json() as Promise<ReferralResponse>) : null))
      .then((data) => {
        if (!ignore && data?.link) setLink(data.link);
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [enabled]);

  return link;
}

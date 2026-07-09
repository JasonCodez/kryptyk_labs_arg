
"use client";
import { SessionProvider } from "next-auth/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AchievementNotification from "@/components/AchievementNotification";
import SlotMachineModal from "@/components/puzzle/SlotMachineModal";
import { rarityColors } from "@/lib/rarity";
import { useSession } from "next-auth/react";
import { useAchievementModalStore } from "@/lib/achievement-modal-store";
import { useModalQueueStore } from "@/lib/modal-queue-store";
import { useSlotModalStore } from "@/lib/slot-modal-store";
import TeamLobbyInviteModalProvider from "@/components/teams/TeamLobbyInviteModalProvider";

const Navbar = dynamic(() => import("@/components/Navbar"), { ssr: false });
const AppSplashScreen = dynamic(() => import("@/components/AppSplashScreen"), { ssr: false });
const AppBottomNav = dynamic(() => import("@/components/AppBottomNav"), { ssr: false });
const IOSInstallBanner = dynamic(() => import("@/components/IOSInstallBanner"), { ssr: false });
const EarlyAccessBanner = dynamic(() => import("@/components/EarlyAccessBanner"), { ssr: false });

let globalSocket: any = null;

function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (!cancelled) {
          void registration.update();
        }
      } catch {
        // ignore
      }
    };

    if (document.readyState === "complete") {
      void register();
      return () => {
        cancelled = true;
      };
    }

    const onLoad = () => {
      void register();
    };

    window.addEventListener("load", onLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}

function GlobalAchievementModal() {
  const { data: session } = useSession();
  const achievementQueue = useAchievementModalStore((s) => s.achievementQueue);
  const enqueueAchievement = useAchievementModalStore((s) => s.enqueueAchievement);
  const dequeueAchievement = useAchievementModalStore((s) => s.dequeueAchievement);
  const shownAchievements = useAchievementModalStore((s) => s.shownAchievements);
  const addShownAchievement = useAchievementModalStore((s) => s.addShownAchievement);
  const setShownAchievements = useAchievementModalStore((s) => s.setShownAchievements);
  const [collecting, setCollecting] = useState<string | null>(null);

  const currentAchievement = achievementQueue[0] ?? null;

  const shownStorageKey = session?.user?.email ? `achievement-modal-shown:${session.user.email}` : null;

  const persistShown = () => {
    try {
      if (!shownStorageKey) return;
      const ids = Array.from(useAchievementModalStore.getState().shownAchievements);
      localStorage.setItem(shownStorageKey, JSON.stringify(ids));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!session?.user?.email) return;

    // Hydrate shown achievements from localStorage so refresh doesn't re-show.
    try {
      if (shownStorageKey) {
        const raw = localStorage.getItem(shownStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setShownAchievements(parsed.filter((x) => typeof x === 'string'));
          }
        }
      }
    } catch {
      // ignore
    }

    let interval: any;
    let mounted = true;
    const fetchAchievements = async () => {
      try {
        const response = await fetch("/api/user/achievements");
        if (response.ok) {
          const result = await response.json();
          result.achievements.forEach((achievement: any) => {
            const autoUnlockTypes = ["puzzles_solved", "submission_accuracy", "points_earned", "streak", "custom"];
            const canAutoCollect = autoUnlockTypes.includes(achievement.conditionType || "");
            const isReady = !achievement.unlocked && achievement.progressPercentage === 100 && canAutoCollect;
            const shown = useAchievementModalStore.getState().shownAchievements;
            if (isReady && !shown.has(achievement.id) && mounted) {
              enqueueAchievement(achievement);
              addShownAchievement(achievement.id);
              persistShown();
            }
          });
        }
      } catch (error) {
        // ignore
      }
    };
    fetchAchievements();
    interval = setInterval(fetchAchievements, 30000);
    // Also check immediately whenever a puzzle is solved
    window.addEventListener('puzzlewarz:puzzle-solved', fetchAchievements);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('puzzlewarz:puzzle-solved', fetchAchievements);
    };
  }, [session?.user?.email, shownStorageKey, enqueueAchievement, addShownAchievement, setShownAchievements]);

  const collectAchievement = async (achievementId: string) => {
    // Dequeue immediately so slow network doesn't leave the modal hanging around.
    // The next achievement in the queue (if any) will show automatically.
    dequeueAchievement();
    setCollecting(achievementId);
    try {
      const response = await fetch("/api/user/achievements/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievementId }),
      });
      // best-effort; modal is already dismissed
      void response;
    } catch (error) {
      // ignore
    } finally {
      setCollecting(null);
    }
  };

  const openModals = useModalQueueStore((s) => s.openModals);

  if (!currentAchievement || openModals.size > 0) return null;
  return (
    <AchievementNotification
      key={currentAchievement.id}
      achievement={currentAchievement}
      rarityColors={rarityColors}
      isCollecting={collecting === currentAchievement.id}
      onClose={() => dequeueAchievement()}
      onCollect={() => collectAchievement(currentAchievement.id)}
    />
  );
}

/**
 * Universal trigger for the level-up slot machine. Level can advance from many server
 * paths (daily puzzles, word search, signup XP, etc.) that never call the puzzle-page's
 * local claim logic, so this polls opportunistically from anywhere in the app instead
 * of relying on a single page to notice a level-up — the same problem/solution shape as
 * GlobalAchievementModal above.
 */
function GlobalSlotMachineModal() {
  const { data: session } = useSession();
  const pendingSpins = useSlotModalStore((s) => s.pendingSpins);
  const setPendingSpins = useSlotModalStore((s) => s.setPendingSpins);
  const clearPendingSpins = useSlotModalStore((s) => s.clearPendingSpins);
  const openModals = useModalQueueStore((s) => s.openModals);

  useEffect(() => {
    if (!session?.user?.email) return;

    let mounted = true;
    const checkForSpins = async () => {
      // Don't clobber a batch already queued/showing with a redundant fetch result.
      if (useSlotModalStore.getState().pendingSpins) return;
      try {
        const response = await fetch("/api/user/claim-level-reward", { method: "POST" });
        if (!response.ok) return;
        const data = await response.json();
        if (mounted && Array.isArray(data.spins) && data.spins.length > 0) {
          setPendingSpins(data.spins);
        }
      } catch {
        // ignore — next poll tries again
      }
    };

    checkForSpins();
    const interval = setInterval(checkForSpins, 30000);
    window.addEventListener("puzzlewarz:puzzle-solved", checkForSpins);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("puzzlewarz:puzzle-solved", checkForSpins);
    };
  }, [session?.user?.email, setPendingSpins]);

  // Wait for any OTHER modal (e.g. the puzzle-solve level-up counter) to close first, so
  // the spin reveal doesn't collide with it — same registry PuzzleXpModal uses. Exclude
  // our own registration (SlotMachineModal registers itself once mounted) or this would
  // immediately hide itself the render after it appears.
  const blockedByOtherModal = Array.from(openModals).some((id) => id !== "slot-machine-modal");
  if (!pendingSpins || blockedByOtherModal) return null;
  return <SlotMachineModal spins={pendingSpins} onDismiss={clearPendingSpins} />;
}

function AuthenticatedEffects() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  useEffect(() => {
    if (!isAuthenticated) {
      // disconnect any existing socket when logged out
      try { globalSocket?.disconnect(); } catch (e) {}
      globalSocket = null;
      return;
    }

    // connect a global socket to receive notifications when user is logged in
    (async () => {
      try {
        const { io } = await import('socket.io-client');

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : '');
        if (!socketUrl) return;

        const socket = io(socketUrl, { transports: ['polling', 'websocket'] });
        globalSocket = socket;

        socket.on('connect', async () => {
          try {
            const res = await fetch('/api/user/info');
            if (res.ok) {
              const j = await res.json();
              const uid = j?.id;
              if (uid) {
                socket.emit('identify', { userId: uid });
              }
            }
          } catch (e) {
            // ignore
          }
        });

        socket.on('notification', (notif: any) => {
          try {
            window.dispatchEvent(new CustomEvent('notificationReceived', { detail: notif }));
          } catch (e) {
            // ignore
          }
        });
      } catch (e) {
        // ignore if socket client can't load
      }
    })();
    return () => {
      try { globalSocket?.disconnect(); } catch (e) {}
      globalSocket = null;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;
  return <TeamLobbyInviteModalProvider />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsStandalone(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Ensure next-auth client always fetches from the current origin.
  // This avoids CLIENT_FETCH_ERROR when NEXTAUTH_URL is set to a different host
  // (e.g. production) or when accessing dev via a LAN IP.
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __NEXTAUTH?: Record<string, unknown> };
    w.__NEXTAUTH = w.__NEXTAUTH || {};
    w.__NEXTAUTH.baseUrl = window.location.origin;
    w.__NEXTAUTH.basePath = (w.__NEXTAUTH.basePath as string) || '/api/auth';
  }

  return (
    <SessionProvider>
      <PwaRegistration />
      <AppSplashScreen />
      {pathname !== '/coming-soon' && <Navbar isStandalone={isStandalone} />}
      <AppBottomNav />
      <GlobalAchievementModal />
      <GlobalSlotMachineModal />
      <AuthenticatedEffects />
      {!isStandalone && <IOSInstallBanner />}
      {!isStandalone && <EarlyAccessBanner />}
      {children}
    </SessionProvider>
  );
}

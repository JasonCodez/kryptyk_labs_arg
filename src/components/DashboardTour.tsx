"use client";

import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";
import type { DriveStep } from "driver.js";

interface DashboardTourProps {
  onComplete: () => void;
}

export default function DashboardTour({ onComplete }: DashboardTourProps) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const isMobile = window.innerWidth < 768;

    import("driver.js").then(({ driver }) => {
      // All possible steps — some are conditionally included based on viewport
      const allSteps: DriveStep[] = [
        {
          // Intro — no element, centered overlay
          popover: {
            title: "Welcome to PuzzleWarz 🧩",
            description:
              "Let's take a quick tour of everything on the platform. Tap <strong>Next</strong> to move forward, <strong>Back</strong> to revisit, or <strong>✕</strong> to exit any time.",
            align: "center",
          },
        },
        {
          element: "#global-nav",
          popover: {
            title: "Navigation",
            description: isMobile
              ? "Tap the <strong>☰ menu</strong> (top right) any time to access all sections: Puzzles, Warz, Daily, Teams, Leaderboards, and more."
              : "This bar is always visible at the top. It links to <strong>Puzzles</strong>, <strong>Daily</strong>, <strong>Warz</strong>, <strong>Season Pass</strong>, and <strong>Leaderboards</strong>. The <strong>More</strong> dropdown holds Teams, Forum, Achievements, and the Tutorial.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: "#tour-stats",
          popover: {
            title: "Your Stats",
            description:
              "<strong>Puzzles Solved</strong> counts your completions. <strong>Total Points</strong> is your leaderboard currency. <strong>Active Teams</strong> shows your team memberships. <strong>Global Rank</strong> is where you stand among all players.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: "#tour-featured",
          popover: {
            title: "The Debrief — Daily Featured",
            description:
              "A new case drops every day. You get <strong>35 seconds</strong> to read an incident report — then it vanishes and five questions follow. Miss a day and that case is gone forever. Completing it keeps your streak alive.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: "#tour-card-puzzles",
          popover: {
            title: "Solve Puzzles 🧩",
            description:
              "Hundreds of challenges: logic, cryptic, word games, code, and more. Every puzzle awards <strong>points and XP</strong> on completion — speed doesn't affect your reward.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        {
          element: "#tour-card-warz",
          popover: {
            title: "Warz Mode ⚔️",
            description:
              "Head-to-head competitive puzzling. You and an opponent race the same puzzle — first to solve it wins the wager. Your Warz record is tracked on your profile.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        {
          element: "#tour-card-daily",
          popover: {
            title: "Daily Challenge 📅",
            description:
              "A fresh puzzle every day at midnight UTC, available for 24 hours. Build a <strong>streak</strong> for compounding bonus points — one missed day resets it to zero.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        {
          element: "#tour-card-frequency",
          popover: {
            title: "Frequency 📡",
            description:
              "A daily opinion question where your score is based on how many players agreed with you. Part trivia, part social experiment. Streaks work the same as the daily puzzle.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        {
          element: "#tour-card-teams",
          popover: {
            title: "Teams 👥",
            description:
              "Create or join a team of up to 20 players. Combined scores go on the <strong>Team Leaderboard</strong>. Teams get a shared lobby for real-time co-op puzzles.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        {
          element: "#tour-card-leaderboards",
          popover: {
            title: "Leaderboards 🏆",
            description:
              "<strong>Global</strong> (all-time), <strong>Weekly</strong> (resets Monday — good for newer players), and <strong>Team</strong>. Individual puzzles also track fastest solve times.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        {
          element: "#tour-card-achievements",
          popover: {
            title: "Achievements 🎖️",
            description:
              "Badges unlocked automatically by hitting milestones. They display on your public profile and show your all-round activity on the platform.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        {
          element: "#tour-card-profile",
          popover: {
            title: "Your Profile 👤",
            description:
              "Your public page: stats, Warz record, achievements, and cosmetics. Customize your avatar, title, and flair here.",
            side: isMobile ? "bottom" : "top",
            align: "start",
          },
        },
        // Season Pass step — desktop only (link is hidden in mobile nav)
        ...(!isMobile
          ? [
              {
                element: "#tour-season",
                popover: {
                  title: "Season Pass 🏅",
                  description:
                    "A seasonal reward track driven by your XP. Free tier included; premium is $4.99/season. Unlock cosmetics and bonuses as you level up. <strong>Claim rewards before the season ends</strong> — unclaimed items expire.",
                  side: "bottom" as const,
                  align: "center" as const,
                },
              },
            ]
          : []),
        {
          // Final step — no element
          popover: {
            title: "You're Ready! 🎉",
            description:
              "Start by solving a few puzzles to earn your first points, then hit the Daily Challenge to build your streak. Need a refresher? The <strong>Tutorial</strong> page in the menu covers everything in detail. Good luck!",
            align: "center" as const,
          },
        },
      ];

      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayColor: "#000",
        overlayOpacity: 0.75,
        smoothScroll: true,
        allowClose: true,
        stagePadding: isMobile ? 4 : 8,
        stageRadius: 12,
        popoverClass: "pw-tour-popover",
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Start Playing →",
        onDestroyStarted: () => {
          driverObj.destroy();
          onComplete();
        },
        steps: allSteps,
      });

      // Small delay so the dashboard has fully rendered before we start
      setTimeout(() => driverObj.drive(), 300);
    });
  }, [onComplete]);

  return null;
}

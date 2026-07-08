// ---------------------------------------------------------------------------
// Puzzle Warz – Email Templates
// All templates use proper <table>-based HTML email structure for
// maximum compatibility across email clients (Outlook, Gmail, Apple Mail, etc.)
// ---------------------------------------------------------------------------
// Brand palette:
//   Background: #020202    Card bg: gradient #020202→#0a0a0a
//   Primary accent: #FDE74C (yellow)   Secondary accent: #3891A6 (teal)
//   Body text: #DDDBF1    Muted text: #AB9F9D
//   Success: #38D399      Danger: #EF4444
// ---------------------------------------------------------------------------

function extractOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return ""; }
}

// ---------------------------------------------------------------------------
// Shared base wrapper
// ---------------------------------------------------------------------------
function emailWrapper(opts: {
  title: string;
  preheader: string;
  heading: string;
  headingEmoji?: string;
  content: string;
  baseUrl?: string;
}): string {
  const logoUrl = opts.baseUrl
    ? `${opts.baseUrl}/images/puzzle_warz_logo.png`
    : "";
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no"/>
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#020202;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${opts.preheader}</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#020202;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;">

        <!-- Logo -->
        <tr><td style="padding:0 0 14px 0;text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" width="220" alt="Puzzle Warz" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;"/>` : ""}
        </td></tr>

        <!-- Card -->
        <tr><td style="background:linear-gradient(135deg,#020202 0%,#0a0a0a 100%);border:1px solid #3891A6;border-radius:14px;overflow:hidden;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

            <!-- Heading -->
            <tr><td style="padding:26px 26px 6px 26px;text-align:center;">
              <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#FDE74C;line-height:1.25;">
                ${opts.headingEmoji ? opts.headingEmoji + " " : ""}${opts.heading}
              </div>
            </td></tr>

            <!-- Body content -->
            <tr><td style="padding:10px 26px 26px 26px;">
              ${opts.content}
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:14px 6px 0 6px;text-align:center;">
          <div style="font-family:Arial,sans-serif;font-size:11px;color:#AB9F9D;line-height:1.6;">
            &copy; ${year} Puzzle Warz
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Reusable building blocks
// ---------------------------------------------------------------------------

/** CTA button (table-based for Outlook compatibility) */
function ctaButton(href: string, label: string, bgColor = "#3891A6"): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:18px auto 0 auto;">
    <tr><td align="center" bgcolor="${bgColor}" style="border-radius:10px;">
      <a href="${href}" style="display:inline-block;padding:13px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#020202;text-decoration:none;border-radius:10px;">${label}</a>
    </td></tr>
  </table>`;
}

/** Info box with colored left-border accent */
function infoBox(borderColor: string, inner: string): string {
  return `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;">
    <tr><td style="background:rgba(56,145,166,0.07);border-left:4px solid ${borderColor};border-radius:6px;padding:16px 18px;">
      ${inner}
    </td></tr>
  </table>`;
}

// Shared inline-style tokens
const bodyFont =
  "font-family:Arial,sans-serif;font-size:14px;color:#DDDBF1;line-height:1.6;";
const mutedFont =
  "font-family:Arial,sans-serif;font-size:12px;color:#AB9F9D;line-height:1.6;";

function footerNote(): string {
  return `<div style="${mutedFont}margin-top:20px;">You received this email because you have notifications enabled in your preferences.</div>`;
}

// ---------------------------------------------------------------------------
// 1. Welcome / Registration
// ---------------------------------------------------------------------------
export function generateWelcomeEmail(
  userName: string,
  dashboardUrl: string
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "Welcome to Puzzle Warz!",
    preheader: `Welcome aboard, ${safeName}! Your puzzle journey starts now.`,
    heading: "Welcome to Puzzle Warz!",
    headingEmoji: "🎮",
    baseUrl: extractOrigin(dashboardUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px 0;">
          Thanks for joining Puzzle Warz &mdash; the ultimate competitive puzzle platform.
          Here&rsquo;s what you can do right away:
        </p>
      </div>
      ${infoBox(
        "#3891A6",
        `<div style="${bodyFont}">
          <p style="margin:0 0 8px 0;"><strong style="color:#FDE74C;">🧩 Solve Puzzles</strong> &mdash; Tackle Sudoku, crosswords, escape rooms &amp; more</p>
          <p style="margin:0 0 8px 0;"><strong style="color:#FDE74C;">👥 Join Teams</strong> &mdash; Collaborate with friends on team puzzles</p>
          <p style="margin:0 0 8px 0;"><strong style="color:#FDE74C;">🏆 Earn Achievements</strong> &mdash; Unlock badges and climb the leaderboard</p>
          <p style="margin:0;"><strong style="color:#FDE74C;">🛒 Point Store</strong> &mdash; Spend your hard-earned points on themes &amp; cosmetics</p>
        </div>`
      )}
      ${ctaButton(dashboardUrl, "Go to Dashboard")}
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 2. Email Verification
// ---------------------------------------------------------------------------
export function generateEmailVerificationEmail(
  userName: string,
  verifyUrl: string
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "Verify your email",
    preheader: "Verify your email to activate your Puzzle Warz account.",
    heading: "Verify Your Email",
    headingEmoji: "✉️",
    baseUrl: extractOrigin(verifyUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">
          Thanks for signing up for Puzzle Warz. Click the button below to verify your email and activate your account.
        </p>
      </div>
      ${ctaButton(verifyUrl, "Verify Email")}
      <div style="${mutedFont}margin-top:18px;">
        If the button doesn&rsquo;t work, copy and paste this link into your browser:
        <div style="word-break:break-all;margin-top:6px;">
          <a href="${verifyUrl}" style="color:#DDDBF1;text-decoration:underline;">${verifyUrl}</a>
        </div>
      </div>
      <div style="${mutedFont}margin-top:14px;">
        If you didn&rsquo;t create this account, you can safely ignore this email.
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// 3. Password Reset
// ---------------------------------------------------------------------------
export function generatePasswordResetEmail(
  userName: string,
  resetUrl: string
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "Reset your password",
    preheader: "We received a request to reset your Puzzle Warz password.",
    heading: "Reset Your Password",
    headingEmoji: "🔑",
    baseUrl: extractOrigin(resetUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">
          We received a request to reset the password for your Puzzle Warz account.
          Click the button below to choose a new password.
        </p>
      </div>
      ${ctaButton(resetUrl, "Reset Password")}
      <div style="${mutedFont}margin-top:18px;">
        If the button doesn&rsquo;t work, copy and paste this link into your browser:
        <div style="word-break:break-all;margin-top:6px;">
          <a href="${resetUrl}" style="color:#DDDBF1;text-decoration:underline;">${resetUrl}</a>
        </div>
      </div>
      <div style="${mutedFont}margin-top:14px;">
        This link expires in 1 hour. If you didn&rsquo;t request a password reset, you can safely ignore this email &mdash; your password will remain unchanged.
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// 4. Puzzle Release
// ---------------------------------------------------------------------------
export function generatePuzzleReleaseEmail(
  userName: string,
  puzzleTitle: string,
  puzzleUrl: string,
  difficulty: string,
  points: number
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "New Puzzle Released!",
    preheader: `A new puzzle is live: ${puzzleTitle}`,
    heading: "New Puzzle Released!",
    headingEmoji: "🎉",
    baseUrl: extractOrigin(puzzleUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">A new puzzle has been released on Puzzle Warz!</p>
      </div>
      ${infoBox(
        "#3891A6",
        `<div style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#FDE74C;margin:0 0 8px 0;">📋 ${puzzleTitle}</div>
        <div style="${bodyFont}margin:0 0 4px 0;"><strong>Difficulty:</strong> <span style="color:${getDifficultyColor(difficulty)};">${difficulty}</span></div>
        <div style="${bodyFont}margin:0;"><strong>Reward:</strong> ⭐ ${points} points</div>`
      )}
      ${ctaButton(puzzleUrl, "Solve the Puzzle →")}
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 5. Achievement Unlocked
// ---------------------------------------------------------------------------
export function generateAchievementEmail(
  userName: string,
  achievementName: string,
  achievementDescription: string,
  badgeUrl?: string
): string {
  const safeName = userName || "there";
  const badgeHtml = badgeUrl
    ? `<img src="${badgeUrl}" alt="${achievementName}" width="80" height="80" style="display:block;margin:0 auto 12px auto;border-radius:8px;border:0;"/>`
    : "";
  return emailWrapper({
    title: "Achievement Unlocked!",
    preheader: `You unlocked: ${achievementName}`,
    heading: "Achievement Unlocked!",
    headingEmoji: "🏆",
    baseUrl: badgeUrl ? extractOrigin(badgeUrl) : undefined,
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">Congratulations! You&rsquo;ve just unlocked an achievement!</p>
      </div>
      ${infoBox(
        "#38D399",
        `<div style="text-align:center;">
          ${badgeHtml}
          <div style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#38D399;margin:0 0 6px 0;">✨ ${achievementName}</div>
          <div style="${mutedFont}">${achievementDescription}</div>
        </div>`
      )}
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 6. Team Update
// ---------------------------------------------------------------------------
export function generateTeamUpdateEmail(
  userName: string,
  teamName: string,
  updateTitle: string,
  updateMessage: string,
  teamUrl: string
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "Team Update",
    preheader: `New update from ${teamName}: ${updateTitle}`,
    heading: "Team Update",
    headingEmoji: "👥",
    baseUrl: extractOrigin(teamUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">There&rsquo;s a new update from your team <strong>${teamName}</strong>:</p>
      </div>
      ${infoBox(
        "#FDE74C",
        `<div style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#FDE74C;margin:0 0 8px 0;">${updateTitle}</div>
        <div style="${bodyFont}">${updateMessage}</div>`
      )}
      ${ctaButton(teamUrl, "View Team →")}
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 7. Team Lobby Invite
// ---------------------------------------------------------------------------
export function generateTeamLobbyInviteEmail(
  userName: string,
  inviterName: string,
  teamName: string,
  puzzleTitle: string,
  joinUrl: string
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "Lobby Invitation",
    preheader: `${inviterName} invited you to a team lobby for ${teamName}`,
    heading: "Lobby Invitation",
    headingEmoji: "🔔",
    baseUrl: extractOrigin(joinUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">
          <strong>${inviterName}</strong> has invited you to join a team lobby for <strong>${teamName}</strong>.
        </p>
      </div>
      ${infoBox(
        "#3891A6",
        `<div style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#FDE74C;margin:0 0 8px 0;">${puzzleTitle}</div>
        <div style="${mutedFont}">Click the button below to open the lobby and join the game.</div>`
      )}
      ${ctaButton(joinUrl, "Join Lobby →")}
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 8. Leaderboard Update
// ---------------------------------------------------------------------------
export function generateLeaderboardEmail(
  userName: string,
  leaderboardType: "global" | "category" | "team",
  currentRank: number,
  previousRank: number | null,
  points: number,
  leaderboardUrl: string
): string {
  const safeName = userName || "there";
  const rankChange = previousRank ? previousRank - currentRank : null;
  const rankChangeText =
    rankChange === null
      ? "You&rsquo;ve entered the leaderboard!"
      : rankChange > 0
        ? `🔥 You climbed ${rankChange} position${rankChange > 1 ? "s" : ""}!`
        : `📉 You dropped ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? "s" : ""}`;

  return emailWrapper({
    title: "Leaderboard Update",
    preheader: `You're now ranked #${currentRank} on the ${leaderboardType} leaderboard`,
    heading: "Leaderboard Update",
    headingEmoji: "📊",
    baseUrl: extractOrigin(leaderboardUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">Your leaderboard ranking has changed!</p>
      </div>
      ${infoBox(
        "#FDE74C",
        `<div style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#FDE74C;margin:0 0 10px 0;">${rankChangeText}</div>
        <div style="${bodyFont}margin:0 0 4px 0;"><strong>Current Rank:</strong> <span style="color:#FDE74C;font-size:24px;font-weight:bold;">#${currentRank}</span></div>
        <div style="${bodyFont}margin:0 0 4px 0;"><strong>Total Points:</strong> ${points}</div>
        <div style="${bodyFont}margin:0;"><strong>Leaderboard:</strong> ${leaderboardType.charAt(0).toUpperCase() + leaderboardType.slice(1)}</div>`
      )}
      ${ctaButton(leaderboardUrl, "View Leaderboard →")}
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 9. Warz Challenge
// ---------------------------------------------------------------------------
export function generateWarzChallengeEmail(
  userName: string,
  challengerName: string,
  puzzleTitle: string,
  challengeUrl: string,
  wagerPoints?: number
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "You've Been Challenged!",
    preheader: `${challengerName} challenged you to a Warz battle!`,
    heading: "You've Been Challenged!",
    headingEmoji: "⚔️",
    baseUrl: extractOrigin(challengeUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">
          <strong style="color:#FDE74C;">${challengerName}</strong> has thrown down the gauntlet and challenged you to a Warz puzzle battle!
        </p>
      </div>
      ${infoBox(
        "#EF4444",
        `<div style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#FDE74C;margin:0 0 8px 0;">⚔️ ${puzzleTitle}</div>
        <div style="${bodyFont}margin:0 0 4px 0;"><strong>Challenger:</strong> ${challengerName}</div>
        ${wagerPoints ? `<div style="${bodyFont}margin:0;"><strong>Wager:</strong> ⭐ ${wagerPoints} points</div>` : ""}`
      )}
      ${ctaButton(challengeUrl, "Accept Challenge ⚔️", "#EF4444")}
      <div style="${mutedFont}margin-top:14px;">
        Don&rsquo;t keep your opponent waiting &mdash; challenges expire in 24 hours!
      </div>
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 10. Point Store Sale
// ---------------------------------------------------------------------------
export interface StoreSaleItem {
  name: string;
  originalPrice: number;
  salePrice: number;
}

export function generateStoreSaleEmail(
  userName: string,
  saleTitle: string,
  items: StoreSaleItem[],
  storeUrl: string,
  expiresAt?: string
): string {
  const safeName = userName || "there";

  const itemRows = items
    .map((item) => {
      const pct = Math.round(
        ((item.originalPrice - item.salePrice) / item.originalPrice) * 100
      );
      return `
      <tr>
        <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:14px;color:#DDDBF1;border-bottom:1px solid rgba(56,145,166,0.15);">${item.name}</td>
        <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:14px;color:#AB9F9D;border-bottom:1px solid rgba(56,145,166,0.15);text-decoration:line-through;text-align:right;">${item.originalPrice} pts</td>
        <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:14px;color:#38D399;font-weight:700;border-bottom:1px solid rgba(56,145,166,0.15);text-align:right;">${item.salePrice} pts</td>
        <td style="padding:8px 10px;font-family:Arial,sans-serif;font-size:12px;color:#FDE74C;font-weight:700;border-bottom:1px solid rgba(56,145,166,0.15);text-align:right;">-${pct}%</td>
      </tr>`;
    })
    .join("");

  return emailWrapper({
    title: "Point Store Sale!",
    preheader: `${saleTitle} — limited time deals in the Point Store!`,
    heading: saleTitle,
    headingEmoji: "🛒",
    baseUrl: extractOrigin(storeUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 4px 0;">
          There&rsquo;s a limited-time sale happening in the Point Store! Grab these deals before they&rsquo;re gone.
        </p>
      </div>

      <!-- Sale items table -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;border:1px solid rgba(56,145,166,0.2);border-radius:8px;overflow:hidden;">
        <tr style="background:rgba(56,145,166,0.12);">
          <td style="padding:10px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#FDE74C;text-transform:uppercase;">Item</td>
          <td style="padding:10px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#FDE74C;text-transform:uppercase;text-align:right;">Was</td>
          <td style="padding:10px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#FDE74C;text-transform:uppercase;text-align:right;">Now</td>
          <td style="padding:10px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#FDE74C;text-transform:uppercase;text-align:right;">Save</td>
        </tr>
        ${itemRows}
      </table>

      ${expiresAt ? `<div style="${mutedFont}margin-top:4px;">⏰ Sale ends: <strong style="color:#DDDBF1;">${expiresAt}</strong></div>` : ""}
      ${ctaButton(storeUrl, "Visit Store →")}
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// 9. Streak Expiry Warning
// ---------------------------------------------------------------------------
export function generateStreakExpiryEmail(
  userName: string,
  streak: number,
  playUrl: string,
): string {
  const safeName = userName || "there";
  return emailWrapper({
    title: "Your streak expires tonight!",
    preheader: `Don't break your ${streak}-day streak — play today's puzzle before midnight.`,
    heading: `Your ${streak}-Day Streak Is At Risk!`,
    headingEmoji: "🔥",
    baseUrl: extractOrigin(playUrl),
    content: `
      <div style="${bodyFont}">
        <p style="margin:0 0 12px 0;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin:0 0 12px 0;">
          You've built an impressive <strong style="color:#FDE74C;">${streak}-day streak</strong> on Puzzle Warz.
          Today's puzzle resets at midnight UTC &mdash; don't let it burn out tonight.
        </p>
      </div>
      ${infoBox(
        "#FDE74C",
        `<div style="font-family:Arial,sans-serif;font-size:30px;font-weight:900;color:#FDE74C;text-align:center;margin:0 0 4px 0;">🔥 ${streak} days</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#AB9F9D;text-align:center;margin:0;">One solve keeps the fire alive.</div>`
      )}
      ${ctaButton(playUrl, "Play Today's Puzzle →", "#FDE74C")}
      <div style="${mutedFont}margin-top:18px;">
        Miss today and your streak resets to zero. Streak Shields from the store can protect you if you ever need a day off.
      </div>
      ${footerNote()}
    `,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    EASY: "#10B981",
    MEDIUM: "#F59E0B",
    HARD: "#EF4444",
    EXPERT: "#3891A6",
  };
  return colors[difficulty] || "#3891A6";
}

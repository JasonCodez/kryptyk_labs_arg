import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkLocalRateLimit } from "@/lib/requestSecurity";
import {
  BETA_ONLY_MODE,
  BETA_ACCESS_ERROR,
  hasBetaAccess,
  isBetaAllowlistedEmail,
} from "@/lib/betaAccess";

const requireEmailVerification =
  process.env.NODE_ENV === "production" ||
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";

// Google is only registered as a provider once both server-side variables
// are actually present — an empty string passed to GoogleProvider would
// otherwise silently register a broken provider.
export function hasGoogleOAuthConfiguration(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

// Google's own profile display name is not unique across users, while this
// project's User.name column is a unique field — mapping Google's `name`
// directly into it would let two different Google accounts with the same
// human name collide. A later profile-completion pass will let a new OAuth
// user choose their own unique PuzzleWarz display name; here we simply
// leave it unset. Returning `id: profile.sub` (Google's own stable subject
// identifier) is required so NextAuth links the Account row by Google's own
// ID — never a random ID, and never the email itself.
export function mapGoogleProfile(profile: GoogleProfile) {
  const subject = typeof profile.sub === "string" ? profile.sub.trim() : "";
  if (!subject) {
    throw new Error("Google profile is missing a subject identifier.");
  }

  const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
  const picture = typeof profile.picture === "string" && profile.picture.trim() ? profile.picture : null;
  const verified = profile.email_verified === true;

  return {
    id: subject,
    email,
    name: null,
    image: picture,
    emailVerified: verified ? new Date() : null,
  };
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "email@example.com" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error("Invalid credentials");
      }

      const email = credentials.email.trim().toLowerCase();

      // Rate limit: 10 login attempts per email per 15 minutes
      if (checkLocalRateLimit({ key: `auth:login:email:${email}`, limit: 10, windowMs: 15 * 60 * 1000 })) {
        throw new Error("Too many login attempts. Please wait 15 minutes and try again.");
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.password) {
        throw new Error("User not found");
      }

      if (requireEmailVerification && !user.emailVerified) {
        throw new Error("Email not verified. Please check your inbox for the verification link.");
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.password
      );

      if (!isPasswordValid) {
        throw new Error("Invalid password");
      }

      let betaApproved = user.betaApproved;

      if (isBetaAllowlistedEmail(email) && !betaApproved) {
        await prisma.user.update({
          where: { id: user.id },
          data: { betaApproved: true },
        });
        betaApproved = true;
      }

      if (!hasBetaAccess({ email: user.email, role: user.role, betaApproved })) {
        throw new Error(BETA_ACCESS_ERROR);
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        betaApproved,
      };
    },
  }),
  // Uncomment to enable GitHub OAuth
  // GitHubProvider({
  //   clientId: process.env.GITHUB_ID || "",
  //   clientSecret: process.env.GITHUB_SECRET || "",
  // }),
];

if (hasGoogleOAuthConfiguration()) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      profile: mapGoogleProfile,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  // Enforce secure cookie flags in production
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? `__Secure-next-auth.callback-url` : `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      }
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? `__Host-next-auth.csrf-token` : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      }
    },
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  providers,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: {
    async signOut() {
      // This is called when user signs out
    },
    // Fires once, immediately after the adapter persists a brand-new OAuth
    // user (Credentials sign-up goes through /api/auth/register instead and
    // never reaches this event). A first-time allowlisted Google sign-in is
    // approved by the signIn callback below before the row even exists, so
    // this is where that approval actually gets written to the new row.
    async createUser({ user }) {
      const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
      if (!email || !isBetaAllowlistedEmail(email)) return;

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { betaApproved: true },
        });
      } catch (err) {
        console.error("Failed to persist beta approval for new OAuth user:", err);
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials access control already happened inside authorize()
      // above; do not re-check or duplicate it here.
      if (account?.provider !== "google") {
        return true;
      }

      const googleProfile = profile as GoogleProfile | undefined;
      const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
      const verified = googleProfile?.email_verified === true;

      if (!email || !verified) {
        return false;
      }

      if (!BETA_ONLY_MODE) {
        return true;
      }

      let existing: { role: string; betaApproved: boolean } | null = null;
      try {
        existing = await prisma.user.findUnique({
          where: { email },
          select: { role: true, betaApproved: true },
        });
      } catch (err) {
        console.error("Failed to look up existing user during Google sign-in:", err);
        return false;
      }

      if (existing) {
        if (hasBetaAccess({ email, role: existing.role, betaApproved: existing.betaApproved })) {
          if (isBetaAllowlistedEmail(email) && !existing.betaApproved) {
            try {
              await prisma.user.update({
                where: { email },
                data: { betaApproved: true },
              });
            } catch (err) {
              console.error("Failed to persist beta approval for existing Google user:", err);
            }
          }
          return true;
        }
        return false;
      }

      // Brand-new Google user: allow only when allowlisted. The resulting
      // row's betaApproved flag is set by the createUser event above, once
      // the adapter has actually created it.
      return isBetaAllowlistedEmail(email);
    },
    async jwt({ token, user }) {
      if (typeof token.email === "string" && token.email) {
        token.email = token.email.trim().toLowerCase();
      }

      if (user) {
        const signedInUser = user as { id?: string };
        let dbUser: { id: string; role: string; betaApproved: boolean } | null = null;

        try {
          if (typeof signedInUser.id === "string" && signedInUser.id) {
            dbUser = await prisma.user.findUnique({
              where: { id: signedInUser.id },
              select: { id: true, role: true, betaApproved: true },
            });
          } else if (typeof token.email === "string" && token.email) {
            dbUser = await prisma.user.findUnique({
              where: { email: token.email },
              select: { id: true, role: true, betaApproved: true },
            });
          }
        } catch (err) {
          console.error("Failed to hydrate session token from database:", err);
        }

        token.id = dbUser?.id ?? signedInUser.id;
        token.role = dbUser?.role ?? "user";
        token.betaApproved = dbUser?.betaApproved === true;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as {
          id?: string;
          role?: string;
          betaApproved?: boolean;
        };
        sessionUser.id = token.id as string;
        sessionUser.role = typeof token.role === "string" ? token.role : "user";
        sessionUser.betaApproved = token.betaApproved === true;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

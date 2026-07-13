import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Kalam } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";
import CookieBanner from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const handwriting = Kalam({
  variable: "--font-handwriting",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

const siteUrl = "https://puzzlewarz.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#3891A6",
  colorScheme: "dark",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Puzzle Warz",
  manifest: "/manifest.webmanifest",
  title: {
    default: "Puzzle Warz — Daily Hidden Word, Puzzle Library & Multiplayer Challenges",
    template: "%s | Puzzle Warz",
  },
  description:
    "Start with the daily Hidden Word, then move into Gridlock files, crosswords, and competitive puzzle runs across the full Puzzle Warz library.",
  keywords: [
    "daily puzzle",
    "daily word game",
    "hidden word",
    "daily hidden word",
    "logic puzzles online",
    "word puzzle game",
    "crossword puzzles online",
    "multiplayer puzzle game",
    "team puzzles",
    "puzzle competition",
    "leaderboard puzzles",
    "brain teasers online",
    "gridlock puzzle",
    "puzzle library",
    "puzzle battle",
  ],
  authors: [{ name: "Puzzle Warz", url: siteUrl }],
  creator: "Puzzle Warz",
  publisher: "Puzzle Warz",
  category: "games",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Puzzle Warz",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Puzzle Warz",
    title: "Puzzle Warz — Daily Hidden Word, Puzzle Library & Multiplayer Challenges",
    description:
      "Start with the daily Hidden Word, then move into Gridlock files, crosswords, and competitive puzzle runs across the full Puzzle Warz library.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Puzzle Warz — Daily Hidden Word, Puzzle Library & Multiplayer Challenges",
    description:
      "Start with the daily Hidden Word, then move into Gridlock files, crosswords, and competitive puzzle runs across the full Puzzle Warz library.",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
    shortcut: [{ url: "/icon.png", type: "image/png" }],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Puzzle Warz",
      url: siteUrl,
      description: "Daily Hidden Word, Gridlock files, crosswords, and competitive puzzle battles. Compete for the top spot on Puzzle Warz.",
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Puzzle Warz",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/images/puzzle_warz_logo.png`,
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${handwriting.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}

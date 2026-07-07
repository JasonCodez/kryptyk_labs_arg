import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Master puzzle-solving techniques with Puzzle Warz guides, tutorials, and walkthroughs. From beginner logic to advanced cryptographic challenges.",
  alternates: { canonical: "https://puzzlewarz.com/learn" },
  openGraph: {
    title: "Learn | Puzzle Warz",
    description:
      "Master puzzle-solving techniques with guides, tutorials, and walkthroughs. From beginner logic to advanced cryptographic challenges.",
    url: "https://puzzlewarz.com/learn",
    type: "website",
  },
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

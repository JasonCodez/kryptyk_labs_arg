import Link from "next/link";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Privacy Policy | PuzzleWarz",
};

const SECTIONS = [
  {
    title: "1. Overview",
    body: `This Privacy Policy explains how PuzzleWarz collects, uses, stores, and shares information when you use the PuzzleWarz website, mobile app wrapper, and related services (collectively, the "Service"). By using the Service, you agree to the practices described in this Privacy Policy.`,
  },
  {
    title: "2. Information We Collect",
    body: `We may collect the following categories of information:\n\n• Account information, such as your email address, display name, password hash, and authentication provider details when you register or sign in.\n• Gameplay and profile data, such as puzzle progress, streaks, submissions, leaderboard activity, team participation, and reward history.\n• Purchase-related information, such as product selections, transaction status, and Stripe customer identifiers when you buy paid features. PuzzleWarz does not store full payment card numbers.\n• Technical and device data, such as IP address, browser type, app version, device identifiers, crash or request logs, and approximate location inferred from network activity.\n• Cookies and local storage data used to keep you signed in, remember preferences, preserve guest progress where available, and support core site functionality.`,
  },
  {
    title: "3. How We Use Information",
    body: `We use personal information to:\n\n• Create and manage accounts.\n• Authenticate users and secure the Service.\n• Save puzzle progress, streaks, rankings, and multiplayer or team activity.\n• Process purchases, verify premium access, and respond to refunds or payment issues.\n• Provide customer support and respond to requests.\n• Monitor abuse, cheating, fraud, and platform misuse.\n• Maintain, troubleshoot, and improve the Service.`,
  },
  {
    title: "4. Cookies, Local Storage, and Similar Technologies",
    body: `PuzzleWarz uses cookies and similar storage technologies to operate the Service. These tools help us maintain login sessions, remember your settings, preserve gameplay state, and support security features. If you disable cookies, some parts of the Service may not function correctly.`,
  },
  {
    title: "5. Payments",
    body: `If you make a purchase, payment processing is handled by third-party payment providers such as Stripe. PuzzleWarz may receive limited transaction metadata needed to confirm payment, unlock content, prevent fraud, and handle support requests, but we do not store your full card details on our servers.`,
  },
  {
    title: "6. When We Share Information",
    body: `We do not sell your personal information. We may share information only in the following situations:\n\n• With service providers that help us run the Service, such as hosting, authentication, email, database, moderation, and payment providers.\n• With other users when the Service is designed to display information publicly, such as leaderboard names, team names, or user-created content you choose to publish.\n• When required by law, regulation, legal process, or to protect the rights, safety, and security of PuzzleWarz, our users, or the public.\n• As part of a merger, acquisition, financing, or asset sale, subject to applicable confidentiality and legal obligations.`,
  },
  {
    title: "7. Data Retention",
    body: `We retain information for as long as reasonably necessary to operate the Service, comply with legal obligations, resolve disputes, enforce agreements, and maintain security records. Account and gameplay data may remain associated with your account until deletion is requested or the data is no longer needed for legitimate business purposes.`,
  },
  {
    title: "8. Your Choices and Rights",
    body: `You may request access to, correction of, or deletion of your account information by contacting us. You can delete your account directly in Settings, or request help by emailing support@puzzlewarz.com if you cannot sign in. We may retain limited records where required for security, fraud prevention, accounting, tax, or legal compliance.`,
  },
  {
    title: "9. Children's Privacy",
    body: `PuzzleWarz is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information to PuzzleWarz, contact us and we will investigate and take appropriate action.`,
  },
  {
    title: "10. Security",
    body: `We use reasonable administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission over the internet or electronic storage is completely secure, so we cannot guarantee absolute security.`,
  },
  {
    title: "11. International Transfers",
    body: `Your information may be processed and stored in countries other than the one where you live. By using the Service, you understand that your information may be transferred to and processed in jurisdictions that may have different data protection laws than your country of residence.`,
  },
  {
    title: "12. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date below. Your continued use of the Service after an updated Privacy Policy becomes effective means you accept the revised policy.`,
  },
  {
    title: "13. Contact Us",
    body: `If you have questions about this Privacy Policy or want to make a privacy-related request, contact:\n\nPuzzleWarz Support\nsupport@puzzlewarz.com`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-20 px-4" style={{ backgroundColor: "#020202" }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-10 pb-8" style={{ borderBottom: "1px solid rgba(56,145,166,0.2)" }}>
            <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#3891A6" }}>Legal</p>
            <h1 className="text-4xl font-black mb-4" style={{ color: "#fff" }}>Privacy Policy</h1>
            <p className="text-sm" style={{ color: "#555" }}>Last updated: May 7, 2026</p>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#888" }}>
              This page explains what information PuzzleWarz collects, how it is used, and what choices users have.
            </p>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="text-base font-bold mb-2" style={{ color: "#3891A6" }}>{section.title}</h2>
                <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#aaa" }}>
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-14 pt-8 flex flex-wrap gap-4" style={{ borderTop: "1px solid rgba(56,145,166,0.2)" }}>
            <Link href="/terms" className="text-sm hover:opacity-80 transition-opacity" style={{ color: "#3891A6" }}>
              View Terms of Service
            </Link>
            <Link href="/auth/register" className="text-sm hover:opacity-80 transition-opacity" style={{ color: "#3891A6" }}>
              Back to registration
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
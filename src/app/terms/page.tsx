import Link from "next/link";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Terms of Service | PuzzleWarz",
};

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: `By creating an account or using PuzzleWarz (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not access or use the Service. These Terms apply to all visitors, users, and others who access the Service.`,
  },
  {
    title: "2. Eligibility",
    body: `You must be at least 13 years old to use the Service. By registering, you represent and warrant that you meet this age requirement. If you are under 18, you confirm that a parent or legal guardian has reviewed and agreed to these Terms on your behalf.`,
  },
  {
    title: "3. Account Registration",
    body: `You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate, complete, and current information during registration. You must notify us immediately at support@puzzlewarz.com if you suspect any unauthorized access to your account. PuzzleWarz reserves the right to terminate accounts that contain false information or violate these Terms.`,
  },
  {
    title: "4. Acceptable Use",
    body: `You agree not to:\n• Post or transmit content that is unlawful, harassing, defamatory, obscene, or otherwise objectionable.\n• Attempt to reverse-engineer, cheat, exploit, or manipulate any puzzle, scoring system, or leaderboard.\n• Use automated bots, scripts, or other tools to interact with the Service without express written permission.\n• Impersonate another user, moderator, or PuzzleWarz staff member.\n• Attempt to gain unauthorized access to any part of the Service or its underlying infrastructure.\n• Use the Service to distribute spam, malware, or unsolicited commercial communications.\n\nViolations may result in immediate account suspension or termination without notice.`,
  },
  {
    title: "5. User-Generated Content",
    body: `When you create or submit puzzles, forum posts, comments, or other content ("User Content"), you retain ownership of that content. By submitting User Content, you grant PuzzleWarz a worldwide, non-exclusive, royalty-free license to host, display, reproduce, and distribute that content solely for the purpose of operating and improving the Service.\n\nYou are solely responsible for the accuracy, legality, and appropriateness of your User Content. PuzzleWarz reserves the right to remove any User Content at its sole discretion.`,
  },
  {
    title: "6. Intellectual Property",
    body: `All platform code, design, graphics, logos, and original puzzle content created by PuzzleWarz are the exclusive property of PuzzleWarz and protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any PuzzleWarz proprietary content without prior written consent.`,
  },
  {
    title: "7. Privacy",
    body: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. We collect and process personal data only as described in the Privacy Policy. By using the Service you consent to such processing and warrant that all data you provide is accurate.`,
  },
  {
    title: "8. Team Features & Collaborative Play",
    body: `PuzzleWarz offers team and collaborative puzzle modes. When using these features you agree to interact respectfully with other participants. Harassment, hate speech, or targeted abuse of teammates or opponents is strictly prohibited and may result in permanent removal from the Service.`,
  },
  {
    title: "9. Service Availability",
    body: `PuzzleWarz strives for high availability but does not guarantee uninterrupted access to the Service. We reserve the right to modify, suspend, or discontinue any part of the Service at any time with or without notice. PuzzleWarz shall not be liable to you or any third party for any such modification, suspension, or discontinuance.`,
  },
  {
    title: "10. Disclaimer of Warranties",
    body: `The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. PuzzleWarz does not warrant that the Service will be error-free, secure, or free of viruses or other harmful components.`,
  },
  {
    title: "11. Limitation of Liability",
    body: `To the maximum extent permitted by applicable law, PuzzleWarz and its officers, employees, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service, even if advised of the possibility of such damages. Our total aggregate liability to you shall not exceed the greater of (a) the amount you paid to PuzzleWarz in the twelve months preceding the claim, or (b) USD $10.`,
  },
  {
    title: "12. Termination",
    body: `You may close your account at any time by contacting us at support@puzzlewarz.com. PuzzleWarz reserves the right to suspend or permanently terminate your account at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, your right to use the Service ceases immediately.`,
  },
  {
    title: "13. Governing Law",
    body: `These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which PuzzleWarz operates, without regard to its conflict-of-law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in that jurisdiction.`,
  },
  {
    title: "14. Changes to These Terms",
    body: `We may update these Terms from time to time. When we do, we will revise the "Last Updated" date below and, where the changes are material, notify registered users by email or an in-app notice. Your continued use of the Service after any changes constitutes acceptance of the new Terms.`,
  },
  {
    title: "15. Contact Us",
    body: `If you have questions about these Terms, please contact us at:\n\nPuzzleWarz Support\nsupport@puzzlewarz.com`,
  },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-20 px-4" style={{ backgroundColor: "#020202" }}>
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="mb-10 pb-8" style={{ borderBottom: "1px solid rgba(56,145,166,0.2)" }}>
            <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#3891A6" }}>Legal</p>
            <h1 className="text-4xl font-black mb-4" style={{ color: "#fff" }}>Terms of Service</h1>
            <p className="text-sm" style={{ color: "#555" }}>Last updated: April 1, 2026</p>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#888" }}>
              Please read these Terms carefully before creating an account. They form a legally binding agreement between you and PuzzleWarz.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.title}>
                <h2 className="text-base font-bold mb-2" style={{ color: "#3891A6" }}>{s.title}</h2>
                <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#aaa" }}>
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          {/* Back link */}
          <div className="mt-14 pt-8" style={{ borderTop: "1px solid rgba(56,145,166,0.2)" }}>
            <Link href="/auth/register" className="text-sm hover:opacity-80 transition-opacity" style={{ color: "#3891A6" }}>
              ← Back to registration
            </Link>
          </div>

        </div>
      </main>
    </>
  );
}

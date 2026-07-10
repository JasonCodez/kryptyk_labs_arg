"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAnonId, clearPendingRewards } from "@/lib/gridlockAnon";

const TOS_SECTIONS = [
  { title: "1. Acceptance of Terms", body: `By creating an account or using PuzzleWarz (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not access or use the Service. These Terms apply to all visitors, users, and others who access the Service.` },
  { title: "2. Eligibility", body: `You must be at least 13 years old to use the Service. By registering, you represent and warrant that you meet this age requirement. If you are under 18, you confirm that a parent or legal guardian has reviewed and agreed to these Terms on your behalf.` },
  { title: "3. Account Registration", body: `You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate, complete, and current information during registration. You must notify us immediately at support@puzzlewarz.com if you suspect any unauthorized access to your account. PuzzleWarz reserves the right to terminate accounts that contain false information or violate these Terms.` },
  { title: "4. Acceptable Use", body: `You agree not to:\n• Post or transmit content that is unlawful, harassing, defamatory, obscene, or otherwise objectionable.\n• Attempt to reverse-engineer, cheat, exploit, or manipulate any puzzle, scoring system, or leaderboard.\n• Use automated bots, scripts, or other tools to interact with the Service without express written permission.\n• Impersonate another user, moderator, or PuzzleWarz staff member.\n• Attempt to gain unauthorized access to any part of the Service or its underlying infrastructure.\n• Use the Service to distribute spam, malware, or unsolicited commercial communications.\n\nViolations may result in immediate account suspension or termination without notice.` },
  { title: "5. User-Generated Content", body: `When you create or submit puzzles, forum posts, comments, or other content ("User Content"), you retain ownership of that content. By submitting User Content, you grant PuzzleWarz a worldwide, non-exclusive, royalty-free license to host, display, reproduce, and distribute that content solely for the purpose of operating and improving the Service.\n\nYou are solely responsible for the accuracy, legality, and appropriateness of your User Content. PuzzleWarz reserves the right to remove any User Content at its sole discretion.` },
  { title: "6. Intellectual Property", body: `All platform code, design, graphics, logos, and original puzzle content created by PuzzleWarz are the exclusive property of PuzzleWarz and protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any PuzzleWarz proprietary content without prior written consent.` },
  { title: "7. Privacy", body: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. We collect and process personal data only as described in the Privacy Policy. By using the Service you consent to such processing and warrant that all data you provide is accurate.` },
  { title: "8. Team Features & Collaborative Play", body: `PuzzleWarz offers team and collaborative puzzle modes. When using these features you agree to interact respectfully with other participants. Harassment, hate speech, or targeted abuse of teammates or opponents is strictly prohibited and may result in permanent removal from the Service.` },
  { title: "9. Service Availability", body: `PuzzleWarz strives for high availability but does not guarantee uninterrupted access to the Service. We reserve the right to modify, suspend, or discontinue any part of the Service at any time with or without notice. PuzzleWarz shall not be liable to you or any third party for any such modification, suspension, or discontinuance.` },
  { title: "10. Disclaimer of Warranties", body: `The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. PuzzleWarz does not warrant that the Service will be error-free, secure, or free of viruses or other harmful components.` },
  { title: "11. Limitation of Liability", body: `To the maximum extent permitted by applicable law, PuzzleWarz and its officers, employees, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service, even if advised of the possibility of such damages. Our total aggregate liability to you shall not exceed the greater of (a) the amount you paid to PuzzleWarz in the twelve months preceding the claim, or (b) USD $10.` },
  { title: "12. Termination", body: `You may close your account at any time by contacting us at support@puzzlewarz.com. PuzzleWarz reserves the right to suspend or permanently terminate your account at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, your right to use the Service ceases immediately.` },
  { title: "13. Governing Law", body: `These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which PuzzleWarz operates, without regard to its conflict-of-law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in that jurisdiction.` },
  { title: "14. Changes to These Terms", body: `We may update these Terms from time to time. When we do, we will revise the "Last Updated" date below and, where the changes are material, notify registered users by email or an in-app notice. Your continued use of the Service after any changes constitutes acceptance of the new Terms.` },
  { title: "15. Contact Us", body: `If you have questions about these Terms, please contact us at:\n\nPuzzleWarz Support\nsupport@puzzlewarz.com` },
];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const betaOnly = searchParams.get("beta") === "1";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    // Get referral code from URL params
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!tosAccepted) {
      setError("You must accept the Terms of Service to create an account.");
      return;
    }

    // Client-side honeypot guard
    if (honeypot) return;

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, password,
          website: honeypot,
          referralCode: referralCode || undefined,
          marketingOptIn: emailOptIn,
          anonId: getAnonId() || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // In production we require email verification; guide the user instead of auto-signing-in.
      if (data?.requireVerification) {
        clearPendingRewards();
        router.push(`/auth/verify-sent?email=${encodeURIComponent(email)}`);
        return;
      }

      // Sign in after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        clearPendingRewards();
        router.push("/dashboard");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes rg-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,-35px) scale(1.08)} }
        @keyframes rg-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-45px,40px) scale(0.94)} }
        @keyframes rg-fade { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        .rg-card { animation: rg-fade 0.6s ease forwards; }
        .rg-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(56,145,166,0.3); border-radius: 10px; color: #fff; padding: 12px 16px; width: 100%; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; }
        .rg-input::placeholder { color: rgba(255,255,255,0.25); }
        .rg-input:focus { border-color: #3891A6; box-shadow: 0 0 0 3px rgba(56,145,166,0.15); }
        .rg-btn { position:relative; overflow:hidden; }
        .rg-btn::after { content:''; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.12); transform:skewX(-20deg); transition:left 0.5s ease; }
        .rg-btn:hover::after { left:130%; }
      `}</style>

      <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", position: "relative", overflow: "hidden" }}>
        {/* Background orbs */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "10%", right: "12%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.18) 0%, transparent 70%)", animation: "rg-orb1 18s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "8%", left: "6%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.1) 0%, transparent 70%)", animation: "rg-orb2 22s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
        </div>

        <div className="rg-card" style={{ width: "100%", maxWidth: 460, position: "relative" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
          </div>

          {/* Card */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Create your account</h1>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28 }}>
              {betaOnly ? "Private beta: only invited tester emails can register." : "Free to join. Start solving in seconds."}
            </p>

            {betaOnly && (
              <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(56,145,166,0.12)", border: "1px solid rgba(56,145,166,0.3)", color: "#9BD1D6", fontSize: 14 }}>
                Use the same email address you approved for your private beta invite.
              </div>
            )}

            {error && (
              <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 14 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Honeypot */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Display Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="rg-input" autoComplete="name" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="rg-input" autoComplete="email" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min. 8 characters" className="rg-input" autoComplete="new-password" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="rg-input" autoComplete="new-password" />
              </div>

              {/* ToS */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "#3891A6", flexShrink: 0, width: 15, height: 15 }} />
                <span style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
                  I agree to the{" "}
                  <button type="button" onClick={() => setShowTos(true)}
                    style={{ color: "#3891A6", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>
                    Terms of Service
                  </button>
                </span>
              </label>

              {/* Email opt-in */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={emailOptIn} onChange={(e) => setEmailOptIn(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "#3891A6", flexShrink: 0, width: 15, height: 15 }} />
                <span style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
                  Send me emails about updates and new features
                </span>
              </label>

              <button type="submit" disabled={loading || !tosAccepted} className="rg-btn"
                style={{ marginTop: 6, padding: "13px", borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", border: "none", cursor: loading || !tosAccepted ? "not-allowed" : "pointer", opacity: loading || !tosAccepted ? 0.5 : 1, boxShadow: "0 0 28px rgba(56,145,166,0.4)", transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={e => { if (!loading && tosAccepted) { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(56,145,166,0.6)"; }}}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(56,145,166,0.4)"; }}>
                {loading ? "Creating account…" : "Create Account →"}
              </button>
            </form>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#6B7280" }}>
                Already have an account?{" "}
                <Link href={betaOnly ? "/auth/signin?beta=1" : "/auth/signin"} style={{ color: "#FDE74C", fontWeight: 700, textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Link href={betaOnly ? "/coming-soon?beta=1" : "/"} style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#9CA3AF")}
              onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}>
              ← Back to home
            </Link>
          </div>
        </div>

        {/* TOS Modal */}
        {showTos && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.85)" }} onClick={() => setShowTos(false)}>
            <div style={{ width: "100%", maxWidth: 640, maxHeight: "82vh", display: "flex", flexDirection: "column", borderRadius: 20, border: "1px solid rgba(56,145,166,0.3)", background: "#0d1a1b", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(56,145,166,0.15)", flexShrink: 0 }}>
                <div>
                  <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: 0 }}>Terms of Service</h2>
                  <p style={{ color: "#4B5563", fontSize: 12, margin: 0 }}>Last updated: April 1, 2026</p>
                </div>
                <button type="button" onClick={() => setShowTos(false)} style={{ color: "#6B7280", background: "none", border: "none", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>
              <div style={{ flexGrow: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                {TOS_SECTIONS.map(s => (
                  <section key={s.title}>
                    <h3 style={{ color: "#3891A6", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
                    <p style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-line" }}>{s.body}</p>
                  </section>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid rgba(56,145,166,0.15)", flexShrink: 0 }}>
                <button type="button" onClick={() => setShowTos(false)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#6B7280", background: "none", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>Close</button>
                <button type="button" onClick={() => { setTosAccepted(true); setShowTos(false); }} style={{ padding: "8px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "#3891A6", border: "none", cursor: "pointer", boxShadow: "0 0 16px rgba(56,145,166,0.35)" }}>I Agree</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function Register() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

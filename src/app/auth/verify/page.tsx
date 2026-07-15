"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const PrelaunchRewardModal = dynamic(() => import("@/components/PrelaunchRewardModal"), { ssr: false });

type PrelaunchRewards = { xp: number; points: number; solves: number } | null;

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("Verifying your email...");
  const [prelaunchRewards, setPrelaunchRewards] = useState<PrelaunchRewards>(null);

  useEffect(() => {
    const email = searchParams.get("email") || "";
    const token = searchParams.get("token") || "";

    if (!email || !token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    const run = async () => {
      try {
        const resp = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          setStatus("error");
          setMessage(data?.error || "Verification failed.");
          return;
        }

        const data = await resp.json().catch(() => ({}));
        setStatus("success");

        if (data?.prelaunchRewards?.xp > 0 || data?.prelaunchRewards?.points > 0) {
          // Show the reward modal; redirect happens when the user dismisses it
          setPrelaunchRewards(data.prelaunchRewards);
          setMessage("Email verified! Your pre-launch rewards have been deposited.");
        } else {
          setMessage("Email verified! You can now sign in.");
          setTimeout(() => router.push("/auth/signin"), 1500);
        }
      } catch {
        setStatus("error");
        setMessage("Verification failed.");
      }
    };

    run();
  }, [searchParams, router]);

  return (
    <>
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: "#020202",
          backgroundImage: "linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)",
        }}
      >
        <div className="w-full max-w-md">
          <div
            className="border rounded-lg p-8"
            style={{ backgroundColor: "rgba(76, 91, 92, 0.6)", borderColor: "#3891A6" }}
          >
            <h1 className="text-xl font-semibold text-white mb-2">Email Verification</h1>
            <p className="text-sm" style={{ color: "#DDDBF1" }}>
              {message}
            </p>

            {status === "error" && (
              <div className="mt-6">
                <Link href="/auth/signin" className="font-semibold" style={{ color: "#FDE74C" }}>
                  Go to sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {prelaunchRewards && (
        <PrelaunchRewardModal
          xp={prelaunchRewards.xp}
          points={prelaunchRewards.points}
          solves={prelaunchRewards.solves}
          onDismiss={() => {
            setPrelaunchRewards(null);
            router.push("/auth/signin");
          }}
        />
      )}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}

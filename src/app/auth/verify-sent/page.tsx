"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifySentInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

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
            <h1 className="text-xl font-semibold text-white mb-2">Check your email</h1>
            <p className="text-sm" style={{ color: "#DDDBF1" }}>
              We sent a verification link{email ? ` to ${email}` : ""}. Click it to activate your account.
            </p>
            <div className="mt-6">
              <Link href="/auth/signin" className="font-semibold" style={{ color: "#FDE74C" }}>
                Go to sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default function VerifySentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifySentInner />
    </Suspense>
  );
}

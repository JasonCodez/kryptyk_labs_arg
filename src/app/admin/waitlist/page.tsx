"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface WaitlistEntry {
  id: string;
  email: string;
  createdAt: string;
}

export default function AdminWaitlistPage() {
  const { data: session, status } = useSession();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
    if (status === "authenticated") {
      fetchWaitlist();
    }
  }, [status]);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/waitlist");
      if (!res.ok) {
        redirect("/dashboard");
        return;
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this email from the waitlist?")) return;
    setDeleting(id);
    try {
      await fetch("/api/admin/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyAll = () => {
    const text = filtered.map((e) => e.email).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filtered = entries.filter((e) =>
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <main className="min-h-screen pb-16 px-4 max-w-4xl mx-auto" style={{ backgroundColor: "#020202" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin/analytics" className="text-white/30 hover:text-white/60 text-sm transition-colors">
            ← Admin
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="text-2xl font-black text-white">Waitlist</h1>
          {!loading && (
            <span
              className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-black"
              style={{ background: "rgba(56,145,166,0.15)", border: "1px solid rgba(56,145,166,0.3)", color: "#3891A6" }}
            >
              {entries.length.toLocaleString()} emails
            </span>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search emails…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
          <button
            onClick={handleCopyAll}
            disabled={filtered.length === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
            style={{
              background: copied ? "rgba(52,211,153,0.15)" : "rgba(56,145,166,0.15)",
              border: `1px solid ${copied ? "rgba(52,211,153,0.4)" : "rgba(56,145,166,0.3)"}`,
              color: copied ? "#34d399" : "#3891A6",
            }}
          >
            {copied ? "✓ Copied!" : `Copy ${search ? "filtered" : "all"} (${filtered.length})`}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-white/55 text-sm text-center py-20">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-white/55 text-sm text-center py-20">
            {search ? "No emails match your search." : "No waitlist submissions yet."}
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Table header */}
            <div
              className="grid grid-cols-[1fr_160px_44px] px-5 py-3 text-xs font-black tracking-widest uppercase"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              <span>Email</span>
              <span>Submitted</span>
              <span />
            </div>

            {/* Rows */}
            <div>
              {filtered.map((entry, i) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[1fr_160px_44px] items-center px-5 py-3 transition-colors group"
                  style={{
                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="text-sm text-white font-medium truncate pr-4">{entry.email}</span>
                  <span className="text-xs text-white/55 tabular-nums">
                    {new Date(entry.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleting === entry.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                    title="Remove"
                  >
                    {deleting === entry.id ? "…" : "✕"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

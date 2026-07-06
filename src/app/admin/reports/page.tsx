"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Flag, CheckCircle, XCircle, Clock } from "lucide-react";

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  issuer: { id: string; name: string | null; email: string | null };
  target: { id: string; name: string | null; email: string | null };
}

const REASON_LABELS: Record<string, string> = {
  harassment:    "Harassment / bullying",
  hate_speech:   "Hate speech",
  spam:          "Spam / scam",
  impersonation: "Impersonation",
  cheating:      "Cheating / exploits",
  other:         "Other",
};

const STATUS_TABS = ["pending", "reviewed", "dismissed", "all"] as const;

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>("pending");
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      loadReports(activeTab);
    }
  }, [status, activeTab]);

  async function loadReports(tab: typeof STATUS_TABS[number]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?status=${tab}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, newStatus: "reviewed" | "dismissed") {
    setActioning(id);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setReports(r => r.filter(x => x.id !== id));
      }
    } finally {
      setActioning(null);
    }
  }

  if (status === "loading") return <LoadingSpinner size={180} />;
  if (!session) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#020202" }}>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pt-24 pb-10">
        <div className="flex items-center gap-3 mb-8">
          <Flag className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-extrabold text-white">Abuse Reports</h1>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize"
              style={
                activeTab === tab
                  ? { background: "#F59E0B", color: "#000" }
                  : { background: "rgba(255,255,255,0.05)", color: "#9CA3AF" }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading reports…</p>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
            <p className="text-white font-semibold">No {activeTab} reports</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <div
                key={report.id}
                className="rounded-xl p-5 border"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}
                      >
                        {REASON_LABELS[report.reason] ?? report.reason}
                      </span>
                      <span className="text-xs" style={{ color: "#4B5563" }}>
                        {new Date(report.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>

                    <p className="text-sm text-white">
                      <Link href={`/profile/${report.issuer.id}`} className="font-semibold hover:underline" style={{ color: "#3891A6" }}>
                        {report.issuer.name ?? report.issuer.email ?? "Unknown"}
                      </Link>
                      {" reported "}
                      <Link href={`/profile/${report.target.id}`} className="font-semibold hover:underline" style={{ color: "#EF4444" }}>
                        {report.target.name ?? report.target.email ?? "Unknown"}
                      </Link>
                    </p>

                    {report.details && (
                      <p className="text-sm mt-1 italic" style={{ color: "#9CA3AF" }}>
                        "{report.details}"
                      </p>
                    )}
                  </div>

                  {report.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        disabled={actioning === report.id}
                        onClick={() => updateStatus(report.id, "reviewed")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                        style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Reviewed
                      </button>
                      <button
                        disabled={actioning === report.id}
                        onClick={() => updateStatus(report.id, "dismissed")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </div>
                  )}

                  {report.status !== "pending" && (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full capitalize shrink-0"
                      style={
                        report.status === "reviewed"
                          ? { background: "rgba(16,185,129,0.12)", color: "#10B981" }
                          : { background: "rgba(107,114,128,0.15)", color: "#6B7280" }
                      }
                    >
                      {report.status === "reviewed" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {report.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/admin/puzzles" className="text-sm text-sky-400 hover:underline">← Back to Admin</Link>
        </div>
      </main>
    </div>
  );
}

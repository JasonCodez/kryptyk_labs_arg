"use client";

import React from "react";
import Link from "next/link";

type Variant = "success" | "error" | "info";

export default function ActionModal({
  isOpen,
  title,
  message,
  variant = "info",
  onClose,
}: {
  isOpen: boolean;
  title?: string;
  message?: string;
  variant?: Variant;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const bg = variant === "success" ? "bg-emerald-600" : variant === "error" ? "bg-red-600" : "bg-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative max-w-lg w-full rounded-lg shadow-lg overflow-hidden">
        <div className={`${bg} px-6 py-4`}> 
          <h3 className="text-white text-lg font-semibold">{title || (variant === 'success' ? 'Success' : variant === 'error' ? 'Error' : 'Notice')}</h3>
        </div>
        <div className="bg-slate-900 p-6">
          <p className="text-slate-200 mb-4">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-700 text-white hover:opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

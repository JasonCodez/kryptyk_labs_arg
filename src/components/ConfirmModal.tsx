"use client";

import React from "react";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  theme = "default",
  confirmTone = "danger",
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  theme?: "default" | "teamLobby";
  confirmTone?: "danger" | "brand" | "success";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  if (theme === "teamLobby") {
    const toneClass =
      confirmTone === "success"
        ? "bg-emerald-600 hover:bg-emerald-500"
        : confirmTone === "brand"
          ? "bg-cyan-600 hover:bg-cyan-500"
          : "bg-rose-600 hover:bg-rose-500";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

        <div className="relative w-full pw-pop-in" style={{ maxWidth: "min(92vw, 560px)" }}>
          <div className="rounded-3xl bg-gradient-to-r from-cyan-500/60 via-sky-500/60 to-teal-500/60 p-[1px] shadow-[0_26px_70px_rgba(0,0,0,0.55)]">
            <div className="rounded-[calc(1.5rem-1px)] border border-slate-800 bg-slate-950/95 p-6 sm:p-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Confirm Action</div>
              <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">{title || "Confirm"}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">{message}</p>

              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={onCancel}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${toneClass}`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      <div className="relative w-full sm:max-w-md rounded-lg shadow-lg overflow-hidden bg-slate-900 border border-slate-700 pw-pop-in">
        <div className="px-6 py-4 bg-slate-800">
          <h3 className="text-white text-lg font-semibold">{title || 'Confirm'}</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-200 mb-4">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded bg-slate-700 text-white hover:opacity-90"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded bg-red-600 text-white hover:opacity-90"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

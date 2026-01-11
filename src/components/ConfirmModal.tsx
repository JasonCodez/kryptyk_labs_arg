"use client";

import React from "react";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      <div className="relative max-w-md w-full rounded-lg shadow-lg overflow-hidden bg-slate-900 border border-slate-700">
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

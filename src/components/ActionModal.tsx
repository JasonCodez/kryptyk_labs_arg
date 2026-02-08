"use client";

import React, { useEffect, useMemo, useState } from "react";

type Variant = "success" | "error" | "info";
type Theme = "default" | "escapeRoom" | "escapeRoomSpeakeasy";

export default function ActionModal({
  isOpen,
  title,
  message,
  imageUrl,
  description,
  choices,
  onChoice,
  variant = "info",
  theme = "default",
  onClose,
}: {
  isOpen: boolean;
  title?: string;
  message?: string;
  imageUrl?: string | null;
  description?: string;
  choices?: Array<{ label: string }>;
  onChoice?: (index: number) => void;
  variant?: Variant;
  theme?: Theme;
  onClose: () => void;
}) {
  const [forceProxyImage, setForceProxyImage] = useState(false);
  useEffect(() => {
    // Reset per-open/per-image so a previous failure doesn't stick.
    if (isOpen) setForceProxyImage(false);
  }, [isOpen, imageUrl]);

  const resolvedImageSrc = useMemo(() => {
    const raw = (imageUrl || "").trim();
    if (!raw) return null;
    const isRemoteHttp = /^https?:\/\//i.test(raw);
    const proxySrc = isRemoteHttp ? `/api/image-proxy?url=${encodeURIComponent(raw)}` : raw;

    // In production we ship a strict CSP (`img-src 'self' data:`), so remote http(s)
    // images must be loaded through the same-origin proxy to display in the modal.
    if (isRemoteHttp && process.env.NODE_ENV === "production") return proxySrc;
    if (forceProxyImage && isRemoteHttp) return proxySrc;
    return raw;
  }, [imageUrl, forceProxyImage]);

  if (!isOpen) return null;

  const headerBgDefault =
    variant === "success" ? "bg-emerald-600" : variant === "error" ? "bg-red-600" : "bg-slate-700";

  const accentEscapeRoom =
    variant === "success"
      ? "bg-emerald-700"
      : variant === "error"
        ? "bg-red-700"
        : "bg-amber-700";

  const resolvedTitle =
    title || (variant === "success" ? "Success" : variant === "error" ? "Error" : "Notice");

  if (theme === "escapeRoomSpeakeasy") {
    const speakeasyAccent =
      variant === "success" ? "bg-emerald-700" : variant === "error" ? "bg-red-700" : "bg-amber-700";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full sm:max-w-lg">
          <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px] shadow-2xl">
            <div className="overflow-hidden rounded-[14px] bg-neutral-950/95 ring-1 ring-amber-500/30">
              <div className="flex items-stretch gap-0 bg-gradient-to-r from-neutral-950 via-neutral-950 to-amber-950/70">
                <div className={"w-1.5 " + speakeasyAccent} />
                <div className="flex-1 px-6 py-4">
                  <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-amber-200/70">
                    Speakeasy
                  </div>
                  <h3 className="mt-1 text-amber-50 text-lg sm:text-xl font-semibold tracking-wide">
                    {resolvedTitle}
                  </h3>
                </div>
              </div>

              <div className="px-6 py-5">
                {resolvedImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolvedImageSrc}
                    alt={resolvedTitle}
                    className="mb-4 w-full max-h-56 object-contain rounded-lg bg-neutral-900/60 border border-amber-600/30"
                    onError={() => setForceProxyImage(true)}
                  />
                ) : null}

                {description ? <p className="text-amber-100/90 mb-2">{description}</p> : null}
                <p className="text-amber-50/90 leading-relaxed">{message}</p>

                {choices && choices.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {choices.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onChoice?.(idx)}
                        className="px-3 py-1.5 rounded border border-amber-700/50 bg-neutral-900/50 text-amber-50/90 hover:bg-neutral-900/80"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded border border-amber-700/60 bg-neutral-900/60 text-amber-50/90 hover:bg-neutral-900/80"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded bg-amber-700 text-amber-50 hover:bg-amber-600"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (theme === "escapeRoom") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full sm:max-w-lg">
          <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px] shadow-2xl">
            <div className="overflow-hidden rounded-[14px] bg-neutral-950/95 ring-1 ring-amber-500/25">
              <div className="flex items-stretch gap-0 bg-gradient-to-r from-neutral-950 via-neutral-950 to-amber-950/70">
                <div className={"w-1.5 " + accentEscapeRoom} />
                <div className="flex-1 px-6 py-4">
                  <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-amber-200/70">
                    Interaction
                  </div>
                  <h3 className="mt-1 text-amber-50 text-lg sm:text-xl font-semibold tracking-wide">
                    {resolvedTitle}
                  </h3>
                </div>
              </div>

              <div className="px-6 py-5">
                {resolvedImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolvedImageSrc}
                    alt={resolvedTitle}
                    className="mb-4 w-full max-h-56 object-contain rounded-lg bg-neutral-900/60 border border-amber-600/25"
                    onError={() => setForceProxyImage(true)}
                  />
                ) : null}

                {description ? <p className="text-amber-100/80 mb-2">{description}</p> : null}
                <p className="text-amber-50/90 leading-relaxed">{message}</p>

                {choices && choices.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {choices.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onChoice?.(idx)}
                        className="px-3 py-1.5 rounded border border-amber-700/50 bg-neutral-900/50 text-amber-50/90 hover:bg-neutral-900/80"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded border border-amber-700/60 bg-neutral-900/60 text-amber-50/90 hover:bg-neutral-900/80"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded bg-amber-700 text-amber-50 hover:bg-amber-600"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg rounded-lg shadow-lg overflow-hidden">
        <div className={`${headerBgDefault} px-6 py-4`}> 
          <h3 className="text-white text-lg font-semibold">{resolvedTitle}</h3>
        </div>
        <div className="bg-slate-900 p-6">
          {resolvedImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedImageSrc}
              alt={resolvedTitle}
              className="mb-4 w-full max-h-56 object-contain rounded-lg bg-slate-950/40 border border-slate-700"
              onError={() => setForceProxyImage(true)}
            />
          ) : null}
          {description ? <p className="text-slate-300 mb-2">{description}</p> : null}
          <p className="text-slate-200 mb-4">{message}</p>
          {choices && choices.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {choices.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChoice?.(idx)}
                  className="px-3 py-1.5 rounded border border-slate-600 bg-slate-800/40 text-white hover:bg-slate-800/70"
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
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

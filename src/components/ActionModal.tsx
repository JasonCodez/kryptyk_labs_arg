"use client";

import React, { useEffect, useMemo, useState } from "react";

type Variant = "success" | "error" | "info";
type Theme = "default" | "escapeRoom" | "escapeRoomSpeakeasy" | "teamLobby";

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
  zIndex = 50,
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
  zIndex?: number;
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

  const isVideo = useMemo(() => {
    if (!resolvedImageSrc) return false;
    const clean = resolvedImageSrc.split(/[?#]/)[0].toLowerCase();
    return /\.(mp4|webm|mov|avi)$/.test(clean);
  }, [resolvedImageSrc]);

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
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full" style={{ maxWidth: "min(94vw, 760px)", maxHeight: "min(92dvh, 920px)" }}>
          <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px] shadow-2xl">
            <div className="overflow-hidden rounded-[14px] bg-neutral-950/95 ring-1 ring-amber-500/30" style={{ maxHeight: "min(92dvh, 920px)" }}>
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

              <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: "calc(min(92dvh, 920px) - 116px)" }}>
                {resolvedImageSrc ? (
                  isVideo ? (
                     
                    <video
                      src={resolvedImageSrc}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="mb-4 w-full object-contain rounded-lg bg-neutral-900/60 border border-amber-600/30"
                      style={{ maxHeight: "min(46dvh, 420px)" }}
                    />
                  ) : (
                    <div className="mb-4 w-full overflow-hidden rounded-lg bg-neutral-900/60 border border-amber-600/30" style={{ maxHeight: "min(46dvh, 420px)" }}>
                      {/* Slight zoom boosts item readability without changing modal dimensions. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolvedImageSrc}
                        alt={resolvedTitle}
                        className="w-full object-contain"
                        style={{ maxHeight: "min(46dvh, 420px)", transform: "scale(1.5)", transformOrigin: "center center" }}
                        onError={() => setForceProxyImage(true)}
                      />
                    </div>
                  )
                ) : null}

                {description ? <p className="text-amber-100/90 mb-2 text-base sm:text-lg">{description}</p> : null}
                <p className="text-amber-50/90 leading-relaxed text-base sm:text-lg">{message}</p>

                {choices && choices.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {choices.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onChoice?.(idx)}
                        className="px-3 py-2 rounded border border-amber-700/50 bg-neutral-900/50 text-amber-50/90 hover:bg-neutral-900/80 text-sm sm:text-base"
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
                    className="px-4 py-2.5 rounded border border-amber-700/60 bg-neutral-900/60 text-amber-50/90 hover:bg-neutral-900/80 text-sm sm:text-base"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded bg-amber-700 text-amber-50 hover:bg-amber-600 text-sm sm:text-base"
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
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full" style={{ maxWidth: "min(94vw, 760px)", maxHeight: "min(92dvh, 920px)" }}>
          <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px] shadow-2xl">
            <div className="overflow-hidden rounded-[14px] bg-neutral-950/95 ring-1 ring-amber-500/25" style={{ maxHeight: "min(92dvh, 920px)" }}>
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

              <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: "calc(min(92dvh, 920px) - 116px)" }}>
                {resolvedImageSrc ? (
                  isVideo ? (
                     
                    <video
                      src={resolvedImageSrc}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="mb-4 w-full object-contain rounded-lg bg-neutral-900/60 border border-amber-600/25"
                      style={{ maxHeight: "min(46dvh, 420px)" }}
                    />
                  ) : (
                    <div className="mb-4 w-full overflow-hidden rounded-lg bg-neutral-900/60 border border-amber-600/25" style={{ maxHeight: "min(46dvh, 420px)" }}>
                      {/* Slight zoom boosts item readability without changing modal dimensions. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolvedImageSrc}
                        alt={resolvedTitle}
                        className="w-full object-contain"
                        style={{ maxHeight: "min(46dvh, 420px)", transform: "scale(1.5)", transformOrigin: "center center" }}
                        onError={() => setForceProxyImage(true)}
                      />
                    </div>
                  )
                ) : null}

                {description ? <p className="text-amber-100/80 mb-2 text-base sm:text-lg">{description}</p> : null}
                <p className="text-amber-50/90 leading-relaxed text-base sm:text-lg">{message}</p>

                {choices && choices.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {choices.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onChoice?.(idx)}
                        className="px-3 py-2 rounded border border-amber-700/50 bg-neutral-900/50 text-amber-50/90 hover:bg-neutral-900/80 text-sm sm:text-base"
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
                    className="px-4 py-2.5 rounded border border-amber-700/60 bg-neutral-900/60 text-amber-50/90 hover:bg-neutral-900/80 text-sm sm:text-base"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded bg-amber-700 text-amber-50 hover:bg-amber-600 text-sm sm:text-base"
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

  if (theme === "teamLobby") {
    const badgeClass =
      variant === "success"
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        : variant === "error"
          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
          : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

    const closeBtnClass =
      variant === "success"
        ? "bg-emerald-600 hover:bg-emerald-500"
        : variant === "error"
          ? "bg-rose-600 hover:bg-rose-500"
          : "bg-cyan-600 hover:bg-cyan-500";

    const hasTitle = typeof title === "string" && title.trim().length > 0;

    return (
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full" style={{ maxWidth: "min(92vw, 620px)", maxHeight: "min(92dvh, 840px)" }}>
          <div className="rounded-3xl bg-gradient-to-r from-cyan-500/60 via-sky-500/60 to-teal-500/60 p-[1px] shadow-[0_26px_70px_rgba(0,0,0,0.55)]">
            <div className="rounded-[calc(1.5rem-1px)] border border-slate-800 bg-slate-950/95 p-6 sm:p-7 overflow-y-auto" style={{ maxHeight: "min(92dvh, 840px)" }}>
              <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${badgeClass}`}>
                {variant === "success" ? "Success" : variant === "error" ? "Attention" : "Notice"}
              </div>

              {hasTitle ? <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">{title}</h3> : null}

              {description ? <p className={`text-sm text-slate-300 sm:text-base ${hasTitle ? "mt-2" : "mt-3"}`}>{description}</p> : null}
              <p className={`text-sm leading-relaxed text-slate-200 sm:text-base ${(description || hasTitle) ? "mt-2" : "mt-3"}`}>{message}</p>

              {choices && choices.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {choices.map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onChoice?.(idx)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${closeBtnClass}`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full rounded-lg shadow-lg overflow-hidden" style={{ maxWidth: "min(94vw, 760px)", maxHeight: "min(92dvh, 920px)" }}>
        <div className={`${headerBgDefault} px-6 py-4`}> 
          <h3 className="text-white text-lg font-semibold">{resolvedTitle}</h3>
        </div>
        <div className="bg-slate-900 p-6 overflow-y-auto" style={{ maxHeight: "calc(min(92dvh, 920px) - 74px)" }}>
          {resolvedImageSrc ? (
            isVideo ? (
               
              <video
                src={resolvedImageSrc}
                autoPlay
                loop
                muted
                playsInline
                className="mb-4 w-full object-contain rounded-lg bg-slate-950/40 border border-slate-700"
                style={{ maxHeight: "min(46dvh, 420px)" }}
              />
            ) : (
              <div className="mb-4 w-full overflow-hidden rounded-lg bg-slate-950/40 border border-slate-700" style={{ maxHeight: "min(46dvh, 420px)" }}>
                {/* Slight zoom boosts item readability without changing modal dimensions. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedImageSrc}
                  alt={resolvedTitle}
                  className="w-full object-contain"
                  style={{ maxHeight: "min(46dvh, 420px)", transform: "scale(1.5)", transformOrigin: "center center" }}
                  onError={() => setForceProxyImage(true)}
                />
              </div>
            )
          ) : null}
          {description ? <p className="text-slate-300 mb-2 text-base sm:text-lg">{description}</p> : null}
          <p className="text-slate-200 mb-4 text-base sm:text-lg">{message}</p>
          {choices && choices.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {choices.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChoice?.(idx)}
                  className="px-3 py-2 rounded border border-slate-600 bg-slate-800/40 text-white hover:bg-slate-800/70 text-sm sm:text-base"
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

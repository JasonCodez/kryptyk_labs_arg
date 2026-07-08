"use client";

import React from "react";

type ValidationRules = {
  mustContain?: string[];
  mustNotContain?: string[];
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
};

type CodeMasterIDEProps = {
  language?: string;
  brokenCode?: string;
  prefillCss?: string;
  files?: Record<string, string>;
  validationMode?: string;
  validationRules?: ValidationRules;
  expectedFix?: string;
  /** Collapsible "Learn Before You Code" lesson text shown above the IDE */
  theory?: string;
  /** Shown in a celebration banner after the puzzle is solved */
  lessonSummary?: string;
  /** Short concept tags, e.g. ["HTML", "semantic elements", "nav"] */
  concepts?: string[];
  /** Learning track label, e.g. "HTML Basics" */
  track?: string;
  /** Position within the track, e.g. 3 */
  trackOrder?: number;
  /** Puzzle ID — used to key localStorage draft saves */
  puzzleId?: string;
  onCodeChange?: (combinedCode: string) => void;
  solved?: boolean;
  /** Mission/scenario text rendered inside the IDE header */
  scenario?: string;
};

// ─── Draft persistence helpers ───────────────────────────────────────────────
type CodeMasterDraft = {
  fileMap: Record<string, string>;
  savedAt: number; // epoch ms
};

const draftKey = (id: string) => `code-master-draft:${id}`;

function saveDraft(puzzleId: string, fileMap: Record<string, string>): void {
  try {
    const payload: CodeMasterDraft = { fileMap, savedAt: Date.now() };
    localStorage.setItem(draftKey(puzzleId), JSON.stringify(payload));
  } catch { /* quota / SSR — ignore */ }
}

function loadDraft(puzzleId: string): CodeMasterDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(draftKey(puzzleId));
    if (!raw) return null;
    return JSON.parse(raw) as CodeMasterDraft;
  } catch { return null; }
}

function clearDraft(puzzleId: string): void {
  try { localStorage.removeItem(draftKey(puzzleId)); } catch {}
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

// ─── Concept tag color mapping ────────────────────────────────────────────
const conceptColor = (tag: string): string => {
  const t = tag.toLowerCase();
  if (t.startsWith("html"))       return "bg-amber-900/60 text-amber-300 border-amber-700/50";
  if (t.startsWith("css") || t.includes("style") || t.includes("layout") || t.includes("flex") || t.includes("grid"))
                                  return "bg-sky-900/60 text-sky-300 border-sky-700/50";
  if (t.startsWith("js") || t.startsWith("javascript") || t.includes("dom") || t.includes("event"))
                                  return "bg-yellow-900/60 text-yellow-300 border-yellow-700/50";
  if (t.startsWith("typescript") || t.startsWith("ts"))
                                  return "bg-blue-900/60 text-blue-300 border-blue-700/50";
  if (t.startsWith("python"))     return "bg-green-900/60 text-green-300 border-green-700/50";
  return "bg-slate-700/60 text-slate-300 border-slate-600/50";
};

// ─── Track badge color mapping ─────────────────────────────────────────────
const trackColor = (track: string): string => {
  const t = track.toLowerCase();
  if (t.includes("html"))       return "bg-amber-900/40 text-amber-300 border-amber-700/40";
  if (t.includes("css"))        return "bg-sky-900/40 text-sky-300 border-sky-700/40";
  if (t.includes("javascript") || t.includes("js") || t.includes("dom"))
                                return "bg-yellow-900/40 text-yellow-300 border-yellow-700/40";
  if (t.includes("typescript")) return "bg-blue-900/40 text-blue-300 border-blue-700/40";
  if (t.includes("python"))     return "bg-green-900/40 text-green-300 border-green-700/40";
  return "bg-slate-700/40 text-slate-300 border-slate-600/40";
};

// ─── Confetti burst (pure CSS, no library) ──────────────────────────────────
const CONFETTI_COLORS = ["#FDE74C", "#3891A6", "#6ab04c", "#e056fd", "#f9ca24", "#eb4d4b", "#30336b", "#f0932b"];

function ConfettiBurst() {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 1.6 + Math.random() * 1.4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 8,
        circle: Math.random() > 0.5,
        rotStart: Math.random() * 360,
        rotEnd: 360 + Math.random() * 360,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10" aria-hidden>
      <style>{`
        @keyframes cm-confetti-fall {
          0%   { transform: translateY(-10px) rotate(var(--r0)); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(360px) rotate(var(--r1)); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.circle ? "50%" : "2px",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ["--r0" as any]: `${p.rotStart}deg`,
            ["--r1" as any]: `${p.rotEnd}deg`,
            animation: `cm-confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

const buildFiles = (
  language?: string,
  brokenCode?: string,
  prefillCss?: string,
  files?: Record<string, string>
): Record<string, string> => {
  if (files && Object.keys(files).length > 0) {
    return Object.fromEntries(
      Object.entries(files).map(([name, code]) => [name, String(code ?? "")])
    );
  }

  const lang = (language || "html").toLowerCase();
  const code = String(brokenCode ?? "");

  if (lang === "css") {
    return {
      "/index.html": `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Code Master</title>
  </head>
  <body>
    <main>
      <h1>Fix the CSS</h1>
      <p>Edit styles.css to match the scenario.</p>
      <button class="cta">Get Started</button>
    </main>
  </body>
</html>`,
      "/styles.css": code || String(prefillCss ?? "/* Fix the CSS here */"),
    };
  }

  if (lang === "javascript" || lang === "typescript") {
    return {
      "/index.html": `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Code Master</title>
  </head>
  <body>
    <main id="app"></main>
  </body>
</html>`,
      "/index.js": code || "// Fix the JS here",
    };
  }

  return {
    "/index.html": code
      ? code
      : `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Code Master</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <h1>Fix the HTML</h1>
      <p>Edit index.html and styles.css to match the scenario.</p>
    </main>
  </body>
</html>`,
    "/styles.css": String(prefillCss ?? "/* Add styles here */"),
  };
};

const combineFiles = (files: Record<string, string>): string => {
  return Object.entries(files)
    .map(([name, code]) => `/* ${name} */\n${code ?? ""}`)
    .join("\n\n");
};

// Builds a preview document with injected console-capture shim so runtime errors
// are posted back to the parent window as { type: 'cm-error', message: string }.
const buildPreviewDoc = (files: Record<string, string>): string => {
  const html = files["/index.html"] || files["index.html"] || "";
  const css  = files["/styles.css"]  || files["styles.css"]  || "";
  const js   = files["/index.js"]    || files["index.js"]    || "";

  // Console-capture shim — intercepts errors before user scripts run
  const captureShim = [
    "<script>",
    "(function(){",
    "  var _post=function(m){try{window.parent.postMessage({type:'cm-error',message:String(m)},'*');}catch(e){}};",
    "  var _ce=console.error?console.error.bind(console):function(){};",
    "  console.error=function(){_post(Array.prototype.slice.call(arguments).join(' '));_ce.apply(console,arguments);};",
    "  window.addEventListener('error',function(e){_post(e.message+(e.lineno?' (line '+e.lineno+')':''));});",
    "  window.addEventListener('unhandledrejection',function(e){_post(String(e.reason));});",
    "})();",
    "<\/script>",
  ].join("");

  let out = html || "<!doctype html><html><head></head><body></body></html>";

  // Inject shim as earliest possible script in <head>
  out = out.includes("<head>")
    ? out.replace("<head>", `<head>${captureShim}`)
    : `${captureShim}${out}`;

  if (css) {
    const styleTag = `<style>\n${css}\n</style>`;
    out = out.includes("</head>")
      ? out.replace("</head>", `${styleTag}\n</head>`)
      : `${styleTag}\n${out}`;
  }

  if (js) {
    const scriptTag = `<script>\n${js}\n<\/script>`;
    out = out.includes("</body>")
      ? out.replace("</body>", `${scriptTag}\n</body>`)
      : `${out}\n${scriptTag}`;
  }

  return out;
};

const normalizeForCheck = (value: string, ignoreCase?: boolean, ignoreWhitespace?: boolean): string => {
  let v = value ?? "";
  if (ignoreWhitespace) v = v.replace(/\s+/g, " ").trim();
  return ignoreCase ? v.toLowerCase() : v;
};

export default function CodeMasterIDE({
  language,
  brokenCode,
  prefillCss,
  files,
  validationRules,
  theory,
  lessonSummary,
  concepts,
  track,
  trackOrder,
  puzzleId,
  onCodeChange,
  solved,
  scenario,
}: CodeMasterIDEProps) {
  const initialFiles = React.useMemo(
    () => buildFiles(language, brokenCode, prefillCss, files),
    [language, brokenCode, prefillCss, files]
  );

  // ── Draft restore: load saved work on first mount ────────────────
  const [pendingDraft, setPendingDraft] = React.useState<CodeMasterDraft | null>(null);
  const draftInitRef = React.useRef(false);
  React.useEffect(() => {
    if (draftInitRef.current || !puzzleId || solved) return;
    draftInitRef.current = true;
    const saved = loadDraft(puzzleId);
    if (saved) {
      // Validate keys match current puzzle files before offering restore
      const savedKeys = Object.keys(saved.fileMap).sort().join(",");
      const initialKeys = Object.keys(initialFiles).sort().join(",");
      if (savedKeys === initialKeys) {
        setPendingDraft(saved);
      } else {
        // Stale draft from different puzzle version — discard silently
        clearDraft(puzzleId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleId]);

  const [fileMap, setFileMap] = React.useState<Record<string, string>>(initialFiles);
  const [activeFile, setActiveFile] = React.useState<string>(
    Object.keys(initialFiles)[0] || "/index.html"
  );

  // liveDoc is only updated when the user clicks Run — not on every keystroke
  const [liveDoc, setLiveDoc] = React.useState<string>(() => buildPreviewDoc(initialFiles));
  const [isDirty, setIsDirty] = React.useState(false);

  // Theory panel — open by default when there is theory content
  const [theoryOpen, setTheoryOpen] = React.useState(Boolean(theory));

  // Error console state
  const [errors, setErrors] = React.useState<string[]>([]);
  const [consoleOpen, setConsoleOpen] = React.useState(false);

  // Show confetti once when transitioning to solved=true
  const [showConfetti, setShowConfetti] = React.useState(false);
  const prevSolvedRef = React.useRef(solved);
  React.useEffect(() => {
    if (solved && !prevSolvedRef.current) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
    prevSolvedRef.current = solved;
  }, [solved]);

  // Clear draft from storage once puzzle is solved
  React.useEffect(() => {
    if (solved && puzzleId) {
      clearDraft(puzzleId);
      setPendingDraft(null);
    }
  }, [solved, puzzleId]);

  // Reset everything when the puzzle itself changes
  React.useEffect(() => {
    setFileMap(initialFiles);
    setActiveFile(Object.keys(initialFiles)[0] || "/index.html");
    setLiveDoc(buildPreviewDoc(initialFiles));
    setIsDirty(false);
    setErrors([]);
    setTheoryOpen(Boolean(theory));
  }, [initialFiles, theory]);

  // ── Debounce-save draft on every edit ────────────────────────────
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!puzzleId || solved) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDraft(puzzleId, fileMap), 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [fileMap, puzzleId, solved]);

  // Keep parent answer state in sync with every edit
  React.useEffect(() => {
    if (!onCodeChange) return;
    onCodeChange(combineFiles(fileMap));
  }, [fileMap, onCodeChange]);

  // Listen for console errors posted from inside the sandboxed iframe
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (
        e.data &&
        e.data.type === "cm-error" &&
        typeof e.data.message === "string"
      ) {
        setErrors((prev) => [...prev.slice(-19), e.data.message as string]);
        setConsoleOpen(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleRun = () => {
    setErrors([]);
    setLiveDoc(buildPreviewDoc(fileMap));
    setIsDirty(false);
  };

  const handleFileChange = (value: string) => {
    setFileMap((prev) => ({ ...prev, [activeFile]: value }));
    setIsDirty(true);
  };

  // Validation checklist — recomputes live on every keystroke
  const checklistItems = React.useMemo(() => {
    if (!validationRules) return [];
    const combined = combineFiles(fileMap);
    const ic = validationRules.ignoreCase;
    const iw = validationRules.ignoreWhitespace;
    const norm = (s: string) => normalizeForCheck(s, ic, iw);
    const normCombined = norm(combined);
    const items: { label: string; pass: boolean }[] = [];

    for (const chunk of validationRules.mustContain ?? []) {
      if (!chunk) continue;
      items.push({
        label: `Contains: ${chunk.length > 55 ? chunk.slice(0, 55) + "…" : chunk}`,
        pass: normCombined.includes(norm(chunk)),
      });
    }

    for (const chunk of validationRules.mustNotContain ?? []) {
      if (!chunk) continue;
      items.push({
        label: `Avoids: ${chunk.length > 55 ? chunk.slice(0, 55) + "…" : chunk}`,
        pass: !normCombined.includes(norm(chunk)),
      });
    }

    return items;
  }, [fileMap, validationRules]);

  const allPass = checklistItems.length > 0 && checklistItems.every((i) => i.pass);

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden shadow-2xl shadow-black/50">

      {/* ── IDE Title Bar ────────────────────────────────────────────── */}
      {(track || (concepts && concepts.length > 0) || (puzzleId && !solved)) && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900">
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <span className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          {track && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${trackColor(track)}`}>
              🗂 {track}{trackOrder ? ` · Level ${trackOrder}` : ""}
            </span>
          )}
          <div className="flex-1 flex flex-wrap items-center gap-1.5 justify-end">
            {(concepts ?? []).filter(Boolean).map((c) => (
              <span key={c} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${conceptColor(c)}`}>
                {c}
              </span>
            ))}
            {puzzleId && !solved && (
              <span className="text-[10px] text-slate-600 ml-1" title="Progress auto-saved">💾 auto-saved</span>
            )}
          </div>
        </div>
      )}

      {/* ── Draft restore banner ─────────────────────────────────────── */}
      {pendingDraft && !solved && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-yellow-800/50 bg-yellow-950/40">
          <div className="flex items-center gap-2 text-sm text-yellow-200">
            <span>💾</span>
            <span>
              Unsaved work from <strong>{formatRelativeTime(pendingDraft.savedAt)}</strong> — restore it?
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFileMap(pendingDraft.fileMap);
                setActiveFile(Object.keys(pendingDraft.fileMap)[0] || "/index.html");
                setIsDirty(true);
                setPendingDraft(null);
              }}
              className="px-3 py-1 rounded-md text-xs font-semibold bg-yellow-600 hover:bg-yellow-500 text-white transition-colors"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => {
                if (puzzleId) clearDraft(puzzleId);
                setPendingDraft(null);
              }}
              className="px-3 py-1 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Scenario / Mission brief ──────────────────────────────────── */}
      {scenario && (
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-teal-950/50 to-slate-950">
          <span className="text-xl shrink-0 mt-0.5">🎯</span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400/80 mb-1.5">Mission</div>
            <p className="text-sm text-slate-200 leading-relaxed">{scenario}</p>
          </div>
        </div>
      )}

      {/* ── "Learn Before You Code" theory panel ─────────────────────── */}
      {theory && (
        <div className="border-b border-slate-800">
          <button
            type="button"
            onClick={() => setTheoryOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-indigo-950/20 transition-colors"
          >
            <div className="flex items-center gap-2.5 text-sm font-semibold text-indigo-300">
              <span>📖</span>
              <span>Learn Before You Code</span>
              {!theoryOpen && (
                <span className="text-xs font-normal text-slate-500 italic">— theory & concepts</span>
              )}
            </div>
            <span className={`text-slate-500 text-xs transition-transform duration-200 ${theoryOpen ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>
          {theoryOpen && (
            <div className="border-t border-indigo-900/40 bg-indigo-950/20 px-5 py-4">
              <div className="rounded-lg border border-slate-800 bg-[#0d1117] overflow-hidden">
                <pre className="text-[12.5px] text-slate-300 font-mono whitespace-pre leading-[1.75] p-5 overflow-x-auto max-h-[420px] overflow-y-auto">
                  {theory}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lesson complete celebration ───────────────────────────────── */}
      {solved && (
        <div className="relative border-b border-emerald-700/50 bg-emerald-950/30 overflow-hidden px-5 py-5">
          {showConfetti && <ConfettiBurst />}
          <div className="flex items-start gap-3 relative z-10">
            <span className="text-3xl shrink-0">🎉</span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-emerald-400 mb-2">Lesson Complete!</h3>
              {lessonSummary ? (
                <div className="max-h-72 overflow-y-auto rounded-lg bg-emerald-950/40 border border-emerald-800/30 p-3">
                  <pre className="text-sm text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                    {lessonSummary}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Great work — puzzle solved!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── File tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-stretch border-b border-slate-800 bg-slate-900 overflow-x-auto">
        {Object.keys(fileMap).map((file) => {
          const ext = (file.split(".").pop() ?? "").toLowerCase();
          const icon = ext === "html" ? "🌐" : ext === "css" ? "🎨" : (ext === "js" || ext === "ts") ? "⚡" : "📄";
          const isActive = activeFile === file;
          return (
            <button
              key={file}
              type="button"
              onClick={() => setActiveFile(file)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-all ${
                isActive
                  ? "border-indigo-400 text-white bg-slate-950/80"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span>{icon}</span>
              <span>{file.replace(/^\//, "")}</span>
              {isActive && isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 ml-0.5" title="Unsaved changes" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Editor + Preview ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">

        {/* Editor pane */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-[11px] text-slate-500">
            <span className="font-mono">{activeFile.replace(/^\//, "")}</span>
            {solved
              ? <span className="text-emerald-500/80 font-semibold">✓ Solved — read only</span>
              : <span className="italic">auto-saved</span>
            }
          </div>
          <textarea
            value={fileMap[activeFile] ?? ""}
            onChange={(e) => handleFileChange(e.target.value)}
            disabled={solved}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="w-full flex-1 min-h-[300px] lg:min-h-[500px] bg-[#0d1117] text-slate-100 font-mono text-[13px] leading-[1.65] p-4 focus:outline-none focus:ring-1 focus:ring-indigo-600/40 disabled:opacity-50 resize-none"
            style={{ tabSize: 2 }}
          />
        </div>

        {/* Preview pane */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800">
            <span className="text-[11px] text-slate-500 font-mono">preview</span>
            <button
              type="button"
              disabled={solved}
              onClick={handleRun}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40 ${
                isDirty && !solved
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
                  : "bg-slate-700 hover:bg-slate-600 text-slate-300"
              }`}
            >
              ▶ Run
              {isDirty && !solved && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
          <iframe
            title="Code Master Preview"
            sandbox="allow-scripts allow-same-origin"
            className="flex-1 w-full min-h-[300px] lg:min-h-[500px] bg-white"
            srcDoc={liveDoc}
          />
        </div>
      </div>

      {/* ── Error console ─────────────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="border-t border-red-900/40 bg-slate-950">
          <button
            type="button"
            onClick={() => setConsoleOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-mono text-red-400 hover:bg-slate-900/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Console — {errors.length} error{errors.length !== 1 ? "s" : ""}
            </span>
            <span className="text-slate-600 text-[10px]">{consoleOpen ? "▲ hide" : "▼ show"}</span>
          </button>
          {consoleOpen && (
            <div className="px-4 pb-3 space-y-1 max-h-36 overflow-y-auto border-t border-red-900/30">
              {errors.map((err, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono text-red-300 leading-relaxed py-0.5">
                  <span className="text-slate-600 shrink-0">{i + 1}.</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Validation checklist footer ───────────────────────────────── */}
      {checklistItems.length > 0 && !solved && (
        <div className={`border-t px-5 py-4 transition-colors ${
          allPass
            ? "border-emerald-700/50 bg-emerald-950/20"
            : "border-slate-800 bg-slate-900/50"
        }`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Requirements
            </span>
            {allPass && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-900/40 px-2.5 py-0.5 rounded-full border border-emerald-700/50">
                ✓ All requirements met
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {checklistItems.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  item.pass
                    ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-slate-400"
                }`}
              >
                <span className={`font-bold ${item.pass ? "text-emerald-400" : "text-slate-600"}`}>
                  {item.pass ? "✓" : "○"}
                </span>
                {item.label}
              </div>
            ))}
          </div>
          {allPass && (
            <p className="mt-3 text-xs font-medium text-emerald-400/80">
              All requirements met — go ahead and submit your fix below!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

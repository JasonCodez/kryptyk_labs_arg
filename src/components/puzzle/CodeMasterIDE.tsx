"use client";

import React from "react";

type CodeMasterIDEProps = {
  language?: string;
  brokenCode?: string;
  prefillCss?: string;
  files?: Record<string, string>;
  onCodeChange?: (combinedCode: string) => void;
};

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

const injectIntoHtml = (html: string, css: string, js: string): string => {
  let out = html || "<!doctype html><html><head></head><body></body></html>";
  if (css) {
    const styleTag = `<style>\n${css}\n</style>`;
    out = out.includes("</head>")
      ? out.replace("</head>", `${styleTag}\n</head>`)
      : `${styleTag}\n${out}`;
  }
  if (js) {
    const scriptTag = `<script>\n${js}\n</script>`;
    out = out.includes("</body>")
      ? out.replace("</body>", `${scriptTag}\n</body>`)
      : `${out}\n${scriptTag}`;
  }
  return out;
};

export default function CodeMasterIDE({
  language,
  brokenCode,
  prefillCss,
  files,
  onCodeChange,
}: CodeMasterIDEProps) {
  const initialFiles = React.useMemo(
    () => buildFiles(language, brokenCode, prefillCss, files),
    [language, brokenCode, prefillCss, files]
  );

  const [fileMap, setFileMap] = React.useState<Record<string, string>>(initialFiles);
  const [activeFile, setActiveFile] = React.useState<string>(Object.keys(initialFiles)[0] || "/index.html");

  React.useEffect(() => {
    setFileMap(initialFiles);
    setActiveFile(Object.keys(initialFiles)[0] || "/index.html");
  }, [initialFiles]);

  React.useEffect(() => {
    if (!onCodeChange) return;
    onCodeChange(combineFiles(fileMap));
  }, [fileMap, onCodeChange]);

  const html = fileMap["/index.html"] || fileMap["index.html"] || "";
  const css = fileMap["/styles.css"] || fileMap["styles.css"] || "";
  const js = fileMap["/index.js"] || fileMap["index.js"] || "";
  const previewDoc = injectIntoHtml(html, css, js);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_1fr] gap-3">
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
        <div className="text-xs uppercase text-slate-400 mb-2">Files</div>
        <div className="space-y-1">
          {Object.keys(fileMap).map((file) => (
            <button
              key={file}
              type="button"
              onClick={() => setActiveFile(file)}
              className={`w-full text-left px-2 py-1 rounded text-xs ${
                activeFile === file
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {file.replace(/^\//, "")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
        <div className="text-xs uppercase text-slate-400 mb-2">
          {activeFile.replace(/^\//, "")}
        </div>
        <textarea
          value={fileMap[activeFile] ?? ""}
          onChange={(e) => setFileMap((prev) => ({ ...prev, [activeFile]: e.target.value }))}
          className="w-full h-[420px] rounded bg-slate-950/80 text-slate-100 font-mono text-xs p-3 border border-slate-800"
        />
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
        <div className="text-xs uppercase text-slate-400 mb-2">Preview</div>
        <iframe
          title="Code Master Preview"
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-[420px] rounded border border-slate-800 bg-black"
          srcDoc={previewDoc}
        />
      </div>
    </div>
  );
}

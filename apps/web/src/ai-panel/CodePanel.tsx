import { useState } from "react";

import { CodeIcon, CopyIcon, DownloadIcon } from "./icons";

const FILE_NAMES: Record<string, string> = {
  prisma: "schema.prisma",
  sql: "schema.sql",
  mongoose: "models.js",
  mermaid: "diagram.mmd",
  json: "diagram.json",
};

type CodePanelProps = {
  code: {
    language: string;
    content: string;
  };
  fileName?: string;
};

export function CodePanel({ code, fileName }: CodePanelProps) {
  const [copied, setCopied] = useState(false);
  const resolvedFileName =
    fileName ?? FILE_NAMES[code.language] ?? `${code.language}.txt`;
  const lines = code.content.split("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = resolvedFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bw-code">
      <div className="bw-code-head">
        <div className="bw-code-file">
          <span className="bw-code-file-icon">
            <CodeIcon size={14} />
          </span>
          <span className="bw-code-name">{resolvedFileName}</span>
          <span className="bw-code-badge">Generated</span>
        </div>
        <div className="bw-code-actions">
          <button type="button" onClick={handleCopy}>
            <CopyIcon size={13} /> {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={handleDownload}>
            <DownloadIcon size={13} /> Download
          </button>
        </div>
      </div>
      <pre className="bw-code-body" aria-label={`${code.language} output`}>
        <code>
          {lines.map((line, index) => (
            <span key={index} className="bw-code-line">
              <span className="bw-code-line-no" aria-hidden="true">
                {index + 1}
              </span>
              <span className="bw-code-text">{line === "" ? " " : line}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

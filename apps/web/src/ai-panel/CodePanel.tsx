import { useState } from "react";

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
};

export function CodePanel({ code }: CodePanelProps) {
  const [copied, setCopied] = useState(false);
  const fileName = FILE_NAMES[code.language] ?? `${code.language}.txt`;

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
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="code-panel">
      <div className="code-panel-header">
        <span className="code-panel-language">{fileName}</span>
        <div className="code-panel-actions">
          <button type="button" className="code-copy" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="code-download"
            onClick={handleDownload}
          >
            Download
          </button>
        </div>
      </div>
      <pre className="code-panel-content">
        <code>{code.content}</code>
      </pre>
    </div>
  );
}

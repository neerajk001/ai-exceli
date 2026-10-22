import { useEffect, useState, type ReactNode } from "react";

import { MODE_BY_ID } from "./aiModes";
import {
  useAIWorkspace,
  type AIHistoryEntry,
  type OutputTab,
} from "./AIWorkspaceContext";
import { CodePanel } from "./CodePanel";
import {
  ApplyIcon,
  ArrowRightIcon,
  AskIcon,
  CodeIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  GenerateIcon,
  NodeKindIcon,
  SparkleIcon,
} from "./icons";

const TAB_LABELS: Record<OutputTab, string> = {
  code: "Code",
  documentation: "Documentation",
  explanation: "Explanation",
  next: "Next steps",
};

const FILE_NAMES: Record<string, string> = {
  prisma: "schema.prisma",
  sql: "schema.sql",
  mongoose: "models.js",
  mermaid: "diagram.mmd",
  json: "diagram.json",
};

function firstLine(value: string | undefined, fallback: string) {
  const line = value?.split("\n")[0]?.trim();

  return line && line.length > 0 ? line : fallback;
}

function buildDocumentation(entry: AIHistoryEntry) {
  const labels = new Map(
    entry.graph.nodes.map((node) => [
      node.id,
      firstLine(node.text, `Untitled ${node.kind}`),
    ]),
  );

  const items = entry.graph.nodes.map((node) => {
    const outgoing = entry.graph.edges
      .filter((edge) => edge.from === node.id)
      .map((edge) => {
        const target = labels.get(edge.to) ?? "unknown";

        return edge.label ? `${target} (${edge.label})` : target;
      });
    const incoming = entry.graph.edges
      .filter((edge) => edge.to === node.id)
      .map((edge) => {
        const source = labels.get(edge.from) ?? "unknown";

        return edge.label ? `${source} (${edge.label})` : source;
      });

    const connections = [
      ...outgoing.map((target) => `Connects to ${target}`),
      ...incoming.map((source) => `Receives from ${source}`),
    ];

    return {
      id: node.id,
      kind: node.kind,
      label: labels.get(node.id) ?? "Untitled",
      connections:
        connections.length > 0 ? connections.join(" · ") : "No connections",
    };
  });

  return {
    summary: `${entry.graph.nodes.length} node${
      entry.graph.nodes.length === 1 ? "" : "s"
    } · ${entry.graph.edges.length} connection${
      entry.graph.edges.length === 1 ? "" : "s"
    }`,
    items,
  };
}

function statusLabel(entry: AIHistoryEntry, playing: boolean) {
  switch (entry.status) {
    case "pending":
      return playing ? "Applying changes" : "Awaiting approval";
    case "applied":
      return "Applied to canvas";
    case "cancelled":
      return "Discarded";
    default:
      return entry.code ? "Generated" : "Complete";
  }
}

type NextStep = {
  id: string;
  title: string;
  copy: string;
  icon: ReactNode;
  action?: () => void;
};

export function AIOutput() {
  const {
    mode,
    activeEntry,
    activeEntryId,
    outputTab,
    setOutputTab,
    pending,
    playing,
    busy,
    applyPending,
    cancelPending,
    selectMode,
  } = useAIWorkspace();
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [activeEntryId]);

  useEffect(() => {
    setMoreOpen(false);
  }, [activeEntryId]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopied(false), 1600);

    return () => window.clearTimeout(timer);
  }, [copied]);

  const primaryTab: OutputTab = activeEntry?.code
    ? "code"
    : activeEntry?.answer
      ? "explanation"
      : "next";
  const primaryTabs: OutputTab[] =
    primaryTab === "next" ? ["next"] : [primaryTab, "next"];
  const secondaryTabs: OutputTab[] = [];

  if (activeEntry) {
    secondaryTabs.push("documentation");
  }

  if (activeEntry?.answer && primaryTab !== "explanation") {
    secondaryTabs.push("explanation");
  }

  const availableTabs = [...primaryTabs, ...secondaryTabs];
  const activeTab = availableTabs.includes(outputTab)
    ? outputTab
    : primaryTab;
  const showSecondary =
    moreOpen || secondaryTabs.includes(activeTab);
  const orderedTabs = showSecondary
    ? [...primaryTabs, ...secondaryTabs]
    : primaryTabs;
  const meta = MODE_BY_ID[mode];

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const buildNextSteps = (): NextStep[] => {
    const entry = activeEntry;
    const steps: NextStep[] = [];

    if (pending) {
      steps.push({
        id: "apply",
        title: "Apply these changes",
        copy: "Review the proposal, then update the canvas with one click.",
        icon: <ApplyIcon size={17} />,
        action: () => void applyPending(),
      });
      steps.push({
        id: "cancel",
        title: "Discard and keep editing",
        copy: "Leave the canvas exactly as it is and continue working.",
        icon: <ArrowRightIcon size={17} />,
        action: cancelPending,
      });
    }

    if (entry?.code) {
      steps.push({
        id: "copy",
        title: copied ? "Code copied" : "Copy the generated code",
        copy: "Drop it into your project or share it with your team.",
        icon: <CopyIcon size={17} />,
        action: () => void copyText(entry.code?.content ?? ""),
      });
      steps.push({
        id: "download",
        title: "Download the file",
        copy: "Save the output locally with the right file extension.",
        icon: <DownloadIcon size={17} />,
        action: () =>
          downloadText(
            FILE_NAMES[entry.code?.language ?? ""] ??
              `${entry.code?.language ?? "code"}.txt`,
            entry.code?.content ?? "",
          ),
      });
    }

    if (entry && entry.status !== "pending") {
      if (entry.mode !== "toCode") {
        steps.push({
          id: "code",
          title: "Generate code from this diagram",
          copy: "Turn the current structure into Prisma, SQL, Mermaid or JSON.",
          icon: <CodeIcon size={17} />,
          action: () => selectMode("toCode"),
        });
      }

      steps.push({
        id: "ask",
        title: "Ask a follow-up",
        copy: "Keep the same canvas and dig into the parts that matter.",
        icon: <AskIcon size={17} />,
        action: () => {
          selectMode("ask");
          window.setTimeout(() => {
            document.getElementById("bw-ai-input")?.focus();
          }, 60);
        },
      });
    }

    if (!entry && !pending) {
      steps.push({
        id: "start",
        title: `Start with ${meta.label}`,
        copy: meta.description,
        icon: <SparkleIcon size={17} />,
      });
    }

    if (entry?.highlightIds?.length) {
      steps.push({
        id: "highlight",
        title: "Keep the highlight",
        copy: `${entry.highlightIds.length} relevant shape${
          entry.highlightIds.length === 1 ? " is" : "s are"
        } selected on the canvas.`,
        icon: <GenerateIcon size={17} />,
      });
    }

    return steps;
  };

  const outputBody = () => {
    if (!activeEntry) {
      return (
        <div className="bw-empty">
          <span className="bw-empty-icon">
            <SparkleIcon size={24} />
          </span>
          <h3>Ready when you are.</h3>
          <p>
            Run this feature and the result will appear here with everything
            you need next.
          </p>
          <ul>
            <li>Context from the shapes on your canvas</li>
            <li>Clear output you can copy or apply</li>
            <li>History that stays with this board</li>
          </ul>
        </div>
      );
    }

    if (activeTab === "code" && activeEntry.code) {
      return (
        <CodePanel
          code={activeEntry.code}
          fileName={
            FILE_NAMES[activeEntry.code.language] ??
            `${activeEntry.code.language}.txt`
          }
        />
      );
    }

    if (activeTab === "explanation") {
      return (
        <div className="bw-prose">
          {activeEntry.answer ? (
            <p>{activeEntry.answer}</p>
          ) : (
            <p className="bw-muted">
              This run did not return a written explanation. Review the canvas
              or open the next steps for a suggested follow-up.
            </p>
          )}
          {activeEntry.highlightIds?.length ? (
            <p className="bw-prose-note">
              Highlighted {activeEntry.highlightIds.length} relevant shape
              {activeEntry.highlightIds.length === 1 ? "" : "s"} on the canvas.
            </p>
          ) : null}
        </div>
      );
    }

    if (activeTab === "documentation") {
      const documentation = buildDocumentation(activeEntry);

      return (
        <div className="bw-doc">
          <div className="bw-doc-overview">
            <h3>Schema overview</h3>
            <p>
              {documentation.summary} captured when this result was generated.
            </p>
          </div>
          {documentation.items.length === 0 ? (
            <p className="bw-muted">
              There were no shapes on the canvas for this run.
            </p>
          ) : (
            <div className="bw-doc-list">
              {documentation.items.map((item) => (
                <article key={item.id} className="bw-doc-item">
                  <span className="bw-doc-icon">
                    <NodeKindIcon kind={item.kind} size={15} />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.connections}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bw-next">
        <div className="bw-next-head">
          <h3>Recommended next steps</h3>
          <p>Keep building with AI using this result and canvas.</p>
        </div>
        <div className="bw-next-list">
          {buildNextSteps().map((step) => (
            <button
              key={step.id}
              type="button"
              className="bw-next-item"
              disabled={busy}
              onClick={step.action}
            >
              <span className="bw-next-icon">{step.icon}</span>
              <span className="bw-next-copy">
                <strong>{step.title}</strong>
                <span>{step.copy}</span>
              </span>
              <span className="bw-next-arrow">
                <ArrowRightIcon size={15} />
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="bw-output" aria-label="AI output">
      <div className="bw-output-meta">
        {activeEntry ? (
          <>
            <span className={`bw-status bw-status-${activeEntry.status}`}>
              {statusLabel(activeEntry, playing)}
            </span>
            <span className="bw-output-time">
              {new Date(activeEntry.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="bw-output-prompt" title={activeEntry.prompt}>
              {activeEntry.prompt}
            </span>
          </>
        ) : (
          <span className="bw-output-time">No AI result yet</span>
        )}
      </div>

      {pending ? (
        <div className="bw-pending" role="status">
          <div>
            <strong>
              {playing
                ? `Applying ${pending.ops.length} change${
                    pending.ops.length === 1 ? "" : "s"
                  }...`
                : `${pending.ops.length} canvas change${
                    pending.ops.length === 1 ? "" : "s"
                  } ready`}
            </strong>
            <span>
              {playing
                ? "Stop the animation from the composer if you need to."
                : "Review the proposal, then apply or cancel."}
            </span>
          </div>
          <div className="bw-pending-actions">
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-small"
              disabled={busy}
              onClick={cancelPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-primary bw-btn-small"
              disabled={busy}
              onClick={() => void applyPending()}
            >
              <ApplyIcon size={14} /> Apply to canvas
            </button>
          </div>
        </div>
      ) : null}

      {activeEntry ? (
        <div
          className="bw-output-tabs"
          role="tablist"
          aria-label="AI output sections"
        >
          {primaryTabs.map((tab, index) => (
            <button
              key={tab}
              id={`bw-output-tab-${tab}`}
              type="button"
              role="tab"
              className="bw-output-tab"
              aria-selected={activeTab === tab}
              aria-controls="bw-output-panel"
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setOutputTab(tab)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                  return;
                }

                event.preventDefault();
                const offset = event.key === "ArrowRight" ? 1 : -1;
                const next =
                  orderedTabs[
                    (index + offset + orderedTabs.length) % orderedTabs.length
                  ] ?? tab;

                setOutputTab(next);
                window.setTimeout(() => {
                  document.getElementById(`bw-output-tab-${next}`)?.focus();
                }, 0);
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
          {secondaryTabs.length > 0 ? (
            <button
              type="button"
              className={`bw-output-more${showSecondary ? " bw-output-more-open" : ""}`}
              aria-expanded={showSecondary}
              onClick={() => {
                if (showSecondary) {
                  setMoreOpen(false);

                  if (secondaryTabs.includes(activeTab)) {
                    setOutputTab(primaryTab);
                  }
                } else {
                  setMoreOpen(true);
                }
              }}
            >
              More views
              <ChevronDownIcon size={12} />
            </button>
          ) : null}
          {showSecondary
            ? secondaryTabs.map((tab, index) => (
                <button
                  key={tab}
                  id={`bw-output-tab-${tab}`}
                  type="button"
                  role="tab"
                  className="bw-output-tab bw-output-tab-secondary"
                  aria-selected={activeTab === tab}
                  aria-controls="bw-output-panel"
                  tabIndex={activeTab === tab ? 0 : -1}
                  onClick={() => setOutputTab(tab)}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "ArrowRight" &&
                      event.key !== "ArrowLeft"
                    ) {
                      return;
                    }

                    event.preventDefault();
                    const offset = event.key === "ArrowRight" ? 1 : -1;
                    const position = primaryTabs.length + index;
                    const next =
                      orderedTabs[
                        (position + offset + orderedTabs.length) %
                          orderedTabs.length
                      ] ?? tab;

                    setOutputTab(next);
                    window.setTimeout(() => {
                      document.getElementById(`bw-output-tab-${next}`)?.focus();
                    }, 0);
                  }}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))
            : null}
        </div>
      ) : null}

      <div
        id="bw-output-panel"
        className="bw-output-body"
        role="tabpanel"
        aria-labelledby={`bw-output-tab-${activeTab}`}
      >
        {outputBody()}
      </div>

      {activeEntry && activeEntry.status !== "pending" ? (
        <div className="bw-output-footer">
          <span className="bw-output-footer-label">
            {activeEntry.status === "cancelled"
              ? "Changes discarded"
              : "Result kept in history"}
          </span>
          <button
            type="button"
            className="bw-link-btn"
            onClick={() => setOutputTab(primaryTab)}
          >
            Open primary output
          </button>
        </div>
      ) : null}
    </section>
  );
}

import { excalidrawToGraph, lintGraph, type LintIssue } from "@wb/scene-graph";
import { useState } from "react";

import { useCanvasApi } from "../canvas/CanvasApiContext";
import { highlightElements } from "../canvas/highlight";

export function DiagramCheck() {
  const api = useCanvasApi();
  const [issues, setIssues] = useState<LintIssue[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const check = () => {
    if (!api) {
      return;
    }

    const found = lintGraph(excalidrawToGraph(api.getSceneElements()));

    setIssues(found);
    setStatus(found.length === 0 ? "No issues found" : null);
  };

  const focus = (issue: LintIssue) => {
    if (api) {
      highlightElements(api, issue.nodeIds);
    }
  };

  return (
    <section className="diagram-check">
      <button
        type="button"
        className="page-button"
        disabled={!api}
        onClick={check}
      >
        Check diagram
      </button>

      {status ? <span className="ai-hint">{status}</span> : null}

      {issues && issues.length > 0 ? (
        <ul className="lint-list">
          {issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                className="lint-issue"
                onClick={() => focus(issue)}
              >
                {issue.message}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

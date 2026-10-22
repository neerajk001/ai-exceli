import { excalidrawToGraph, lintGraph, type LintIssue } from "@wb/scene-graph";
import { useState } from "react";

import { useCanvasApi } from "../canvas/CanvasApiContext";
import { highlightElements } from "../canvas/highlight";
import { CheckIcon, ChevronDownIcon } from "./icons";

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
    <details className="bw-check">
      <summary className="bw-check-heading">
        <span className="bw-check-icon">
          <CheckIcon size={14} />
        </span>
        <div>
          <h3>Diagram health</h3>
          <p>Find dangling edges and missing labels.</p>
        </div>
        <span className="bw-check-chevron">
          <ChevronDownIcon size={13} />
        </span>
      </summary>
      <div className="bw-check-body">
        <button
          type="button"
          className="bw-check-btn"
          disabled={!api}
          onClick={check}
        >
          Check diagram
        </button>
        {status ? <span className="bw-check-status">{status}</span> : null}
        {issues && issues.length > 0 ? (
          <ul className="bw-check-list">
            {issues.map((issue) => (
              <li key={issue.id}>
                <button type="button" onClick={() => focus(issue)}>
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

import { excalidrawToGraph } from "@wb/scene-graph";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { useCanvasApi } from "../canvas/CanvasApiContext";
import { highlightElements } from "../canvas/highlight";
import { useAI } from "./useAI";

const MODES = [
  { id: "ask", label: "Ask", enabled: true },
  { id: "toCode", label: "To code", enabled: false },
  { id: "cleanup", label: "Clean up", enabled: false },
  { id: "collaborate", label: "Collaborate", enabled: false },
] as const;

type ModeId = (typeof MODES)[number]["id"];

export function AIPanel() {
  const api = useCanvasApi();
  const { loading, error, result, ask, cancel } = useAI();
  const [mode, setMode] = useState<ModeId>("ask");
  const [input, setInput] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedMode = MODES.find((candidate) => candidate.id === mode);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const question = input.trim();

    if (!question || loading || !selectedMode?.enabled) {
      return;
    }

    if (!api) {
      setHint("Canvas is still loading...");
      return;
    }

    const graph = excalidrawToGraph(api.getSceneElements());

    if (graph.nodes.length === 0) {
      setHint("Draw something first.");
      return;
    }

    setHint(null);

    const response = await ask(graph, question);

    if (response?.highlightIds && response.highlightIds.length > 0) {
      highlightElements(api, response.highlightIds);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <aside className="ai-panel" aria-label="AI panel">
      <h2 className="ai-panel-title">AI</h2>

      <div className="ai-modes">
        {MODES.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="ai-mode"
            aria-pressed={candidate.id === mode}
            disabled={!candidate.enabled}
            title={candidate.enabled ? undefined : "Coming soon"}
            onClick={() => setMode(candidate.id)}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {selectedMode && !selectedMode.enabled ? (
        <p className="ai-hint">Coming soon.</p>
      ) : null}

      <form ref={formRef} className="ai-form" onSubmit={handleSubmit}>
        <textarea
          className="ai-input"
          value={input}
          rows={3}
          placeholder='Ask about your canvas, e.g. "what connects to the database?"'
          disabled={loading}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="ai-actions">
          {hint ? <span className="ai-hint">{hint}</span> : <span />}
          {loading ? (
            <button type="button" className="ai-cancel" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button type="submit" className="ai-send" disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </form>

      {error ? (
        <p className="ai-error" role="alert">
          {error}
        </p>
      ) : null}

      {result?.answer ? <p className="ai-answer">{result.answer}</p> : null}
    </aside>
  );
}

import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { placeNewNodes, tidy } from "@wb/layout";
import { applyOps, excalidrawToGraph } from "@wb/scene-graph";
import { CODE_TARGETS, type CodeTarget, type Op } from "@wb/shared-types";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { playOps } from "../ai-cursor/playOps";
import { useCanvasApi } from "../canvas/CanvasApiContext";
import { exportSceneImageBase64 } from "../canvas/exportImage";
import { highlightElements } from "../canvas/highlight";
import { CodePanel } from "./CodePanel";
import { DiagramCheck } from "./DiagramCheck";
import { useAI } from "./useAI";

const MODES = [
  { id: "ask", label: "Ask", enabled: true },
  { id: "toCode", label: "To code", enabled: true },
  { id: "cleanup", label: "Clean up", enabled: true },
  { id: "collaborate", label: "Collaborate", enabled: true },
  { id: "generate", label: "Generate", enabled: true },
] as const;

type ModeId = (typeof MODES)[number]["id"];

const SEND_LABELS: Record<ModeId, string> = {
  ask: "Send",
  toCode: "Generate",
  cleanup: "Clean up",
  collaborate: "Draw",
  generate: "Draw",
};

export function AIPanel() {
  const api = useCanvasApi();
  const { loading, error, result, ask, toCode, cleanup, collaborate, generate, cancel } =
    useAI();
  const [mode, setMode] = useState<ModeId>("ask");
  const [target, setTarget] = useState<CodeTarget>("prisma");
  const [input, setInput] = useState("");
  const [recognizeStrokes, setRecognizeStrokes] = useState(false);
  const [watchAI, setWatchAI] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const playbackRef = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedMode = MODES.find((candidate) => candidate.id === mode);
  const busy = loading || playing;

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        playbackRef.current?.abort();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [playing]);

  const startPlayback = async (ops: Op[]) => {
    if (!api || ops.length === 0) {
      return;
    }

    const controller = new AbortController();
    playbackRef.current = controller;
    setPlaying(true);
    setHint("AI is drawing...");

    try {
      const played = await playOps({ api, ops, signal: controller.signal });

      if (played.cancelled) {
        setHint(`stopped after ${played.applied} ops`);
      } else {
        const skipped =
          played.skipped > 0 ? `, skipped ${played.skipped}` : "";
        setHint(`applied ${played.applied} ops${skipped}`);
      }
    } catch {
      setHint("Playback failed.");
    } finally {
      playbackRef.current = null;
      setPlaying(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (busy || !selectedMode?.enabled) {
      return;
    }

    if (!api) {
      setHint("Canvas is still loading...");
      return;
    }

    const graph = excalidrawToGraph(api.getSceneElements());

    if (graph.nodes.length === 0 && mode !== "generate") {
      setHint("Draw something first.");
      return;
    }

    setHint(null);

    if (mode === "toCode") {
      await toCode(graph, target);
      return;
    }

    if (mode === "generate") {
      const description = input.trim();

      if (!description) {
        return;
      }

      const response = await generate(graph, description);

      if (response?.ops?.length) {
        await startPlayback(response.ops);
      }

      return;
    }

    if (mode === "collaborate") {
      const instruction = input.trim();

      if (!instruction) {
        return;
      }

      const response = await collaborate(graph, instruction);

      if (response?.ops?.length) {
        await startPlayback(response.ops);
      }

      return;
    }

    if (mode === "cleanup") {
      let imageBase64: string | undefined;

      if (recognizeStrokes) {
        setHint("Exporting the canvas...");

        try {
          imageBase64 = await exportSceneImageBase64(api);
        } catch {
          setHint("Could not export the canvas image.");
          return;
        }
      }

      const response = await cleanup(graph, imageBase64);

      if (!response) {
        setHint(null);
        return;
      }

      const tidyOps = tidy(graph);
      const ops: Op[] = [...(response.ops ?? []), ...tidyOps];

      if (ops.length === 0) {
        setHint("Nothing to clean up.");
        return;
      }

      if (watchAI) {
        await startPlayback(ops);
        return;
      }

      const applied = applyOps(api.getSceneElements(), ops, {
        layout: placeNewNodes,
        preserveGivenGeometry: true,
      });

      api.updateScene({
        elements: applied.elements as unknown as OrderedExcalidrawElement[],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      const skipped =
        applied.skipped.length > 0 ? `, skipped ${applied.skipped.length}` : "";
      setHint(
        `applied ${ops.length - applied.skipped.length}/${ops.length} ops${skipped}`,
      );
      return;
    }

    const question = input.trim();

    if (!question) {
      return;
    }

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

  const placeholder =
    mode === "collaborate"
      ? 'e.g. "add a cache between the API and the DB"'
      : mode === "generate"
        ? 'e.g. "draw an order service with a queue and a database"'
        : 'Ask about your canvas, e.g. "what connects to the database?"';

  const needsInput =
    mode === "ask" || mode === "collaborate" || mode === "generate";

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
            disabled={!candidate.enabled || playing}
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
        {mode === "toCode" ? (
          <label className="ai-field">
            <span className="ai-field-label">Target</span>
            <select
              className="ai-target"
              value={target}
              disabled={busy}
              onChange={(event) => setTarget(event.target.value as CodeTarget)}
            >
              {CODE_TARGETS.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>
        ) : mode === "cleanup" ? (
          <div className="ai-checkboxes">
            <label className="ai-checkbox">
              <input
                type="checkbox"
                checked={recognizeStrokes}
                disabled={busy}
                onChange={(event) => setRecognizeStrokes(event.target.checked)}
              />
              <span>Recognize freehand strokes (sends a canvas image)</span>
            </label>
            <label className="ai-checkbox">
              <input
                type="checkbox"
                checked={watchAI}
                disabled={busy}
                onChange={(event) => setWatchAI(event.target.checked)}
              />
              <span>Watch AI work</span>
            </label>
          </div>
        ) : (
          <textarea
            className="ai-input"
            value={input}
            rows={3}
            placeholder={placeholder}
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        )}

        <div className="ai-actions">
          {hint ? <span className="ai-hint">{hint}</span> : <span />}
          {playing ? (
            <button
              type="button"
              className="ai-cancel"
              onClick={() => playbackRef.current?.abort()}
            >
              Stop
            </button>
          ) : loading ? (
            <button type="button" className="ai-cancel" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              className="ai-send"
              disabled={needsInput && !input.trim()}
            >
              {SEND_LABELS[mode]}
            </button>
          )}
        </div>
      </form>

      {error ? (
        <p className="ai-error" role="alert">
          {error}
        </p>
      ) : null}

      {result?.code ? <CodePanel code={result.code} /> : null}

      {!result?.code && result?.answer ? (
        <p className="ai-answer">{result.answer}</p>
      ) : null}

      <DiagramCheck />
    </aside>
  );
}

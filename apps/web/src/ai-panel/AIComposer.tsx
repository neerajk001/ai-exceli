import { CODE_TARGETS, type CodeTarget } from "@wb/shared-types";
import { type FormEvent, type KeyboardEvent } from "react";

import { MODE_BY_ID, SEND_LABELS } from "./aiModes";
import { useAIWorkspace } from "./AIWorkspaceContext";
import { SendIcon, SparkleIcon, StopIcon } from "./icons";

const CODE_TARGET_LABELS: Record<CodeTarget, string> = {
  prisma: "Prisma schema",
  sql: "SQL",
  mongoose: "MongoDB / Mongoose",
  mermaid: "Mermaid",
  json: "JSON",
};

const NEEDS_INPUT = new Set(["ask", "generate", "collaborate"]);

export function AIComposer() {
  const {
    mode,
    input,
    setInput,
    target,
    setTarget,
    recognizeStrokes,
    setRecognizeStrokes,
    watchAI,
    setWatchAI,
    loading,
    playing,
    busy,
    pending,
    hint,
    submit,
    cancelActive,
    stopPlayback,
  } = useAIWorkspace();
  const meta = MODE_BY_ID[mode];
  const ModeIcon = meta.icon;
  const needsInput = NEEDS_INPUT.has(mode);
  const canSubmit = !busy && !pending && (!needsInput || input.trim().length > 0);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form className="bw-composer" onSubmit={handleSubmit}>
      <div className="bw-composer-heading">
        <span className="bw-composer-icon">
          <ModeIcon size={18} />
        </span>
        <div>
          <h3>{meta.title}</h3>
          <p>{meta.description}</p>
        </div>
      </div>

      {mode === "toCode" ? (
        <>
          <label className="bw-field">
            <span className="bw-field-label">Target</span>
            <span className="bw-select-wrap">
              <select
                className="bw-select"
                value={target}
                disabled={busy}
                onChange={(event) => setTarget(event.target.value as CodeTarget)}
              >
                {CODE_TARGETS.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {CODE_TARGET_LABELS[candidate]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <p className="bw-context-note">
            Uses the shapes currently on your canvas. Generated output appears
            with copy and download actions.
          </p>
        </>
      ) : null}

      {mode === "cleanup" ? (
        <div className="bw-options">
          <label className="bw-option">
            <span className="bw-option-copy">
              <strong>Recognize freehand strokes</strong>
              <span>Sends a snapshot of the canvas to the model.</span>
            </span>
            <input
              type="checkbox"
              checked={recognizeStrokes}
              disabled={busy}
              onChange={(event) => setRecognizeStrokes(event.target.checked)}
            />
          </label>
          <label className="bw-option">
            <span className="bw-option-copy">
              <strong>Watch AI work</strong>
              <span>Animate each change with the AI cursor.</span>
            </span>
            <input
              type="checkbox"
              checked={watchAI}
              disabled={busy}
              onChange={(event) => setWatchAI(event.target.checked)}
            />
          </label>
        </div>
      ) : mode === "toCode" ? null : (
        <label className="bw-field">
          <span className="bw-field-label">
            {mode === "ask"
              ? "Question"
              : mode === "generate"
                ? "Describe a diagram"
                : "Instruction"}
          </span>
          <textarea
            id="bw-ai-input"
            className="bw-textarea"
            value={input}
            rows={3}
            placeholder={meta.placeholder}
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>
      )}

      {meta.examples.length > 0 && !busy ? (
        <div className="bw-examples">
          <span className="bw-examples-label">Try</span>
          {meta.examples.map((example) => (
            <button
              key={example}
              type="button"
              className="bw-example"
              onClick={() => setInput(example)}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      <div className="bw-composer-actions">
        {hint ? <span className="bw-hint">{hint}</span> : <span />}
        {playing ? (
          <button
            type="button"
            className="bw-btn bw-btn-ghost"
            onClick={stopPlayback}
          >
            <StopIcon /> Stop AI
          </button>
        ) : loading ? (
          <button
            type="button"
            className="bw-btn bw-btn-ghost"
            onClick={cancelActive}
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            className="bw-btn bw-btn-primary"
            disabled={!canSubmit}
          >
            <SparkleIcon size={15} /> {SEND_LABELS[mode]} <SendIcon size={14} />
          </button>
        )}
      </div>

      {pending ? (
        <p className="bw-composer-lock">
          Apply or cancel the pending canvas changes before running another
          feature.
        </p>
      ) : null}
    </form>
  );
}

import { AI_MODES } from "./aiModes";
import { AIComposer } from "./AIComposer";
import { AIHistoryList } from "./AIHistoryList";
import { AIOutput } from "./AIOutput";
import { useAIWorkspace } from "./AIWorkspaceContext";
import { DiagramCheck } from "./DiagramCheck";
import { CloseIcon, ExpandIcon, SparkleIcon } from "./icons";
import "./aiWorkspace.css";

export function AIPanel() {
  const { view, setView, mode, selectMode, error } = useAIWorkspace();

  if (view === "collapsed") {
    return (
      <button
        type="button"
        className="bw-ai-launcher"
        onClick={() => setView("panel")}
        title="Open AI (Ctrl/Cmd + K)"
        aria-label="Open AI workspace"
      >
        <span className="bw-ai-launcher-spark">
          <SparkleIcon size={18} />
        </span>
        <span className="bw-ai-launcher-copy">
          <strong>AI</strong>
          <span>Ask, build, clean up</span>
        </span>
        <kbd className="bw-ai-launcher-kbd">⌘K</kbd>
      </button>
    );
  }

  const fullscreen = view === "fullscreen";

  return (
    <aside
      className={`bw-ai-panel${fullscreen ? " bw-ai-panel-fullscreen" : ""}`}
      aria-label="AI workspace"
    >
      <header className="bw-ai-panel-head">
        <span className="bw-ai-panel-mark">
          <SparkleIcon size={18} />
        </span>
        <div className="bw-ai-panel-title">
          <h2>AI Workspace</h2>
          <p>
            {fullscreen
              ? "A dedicated space for your diagram"
              : "Your diagram, understood"}
          </p>
        </div>
        <div className="bw-ai-panel-actions">
          {!fullscreen ? (
            <button
              type="button"
              className="bw-icon-btn"
              title="Fullscreen AI workspace"
              aria-label="Open fullscreen AI workspace"
              onClick={() => setView("fullscreen")}
            >
              <ExpandIcon size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className="bw-icon-btn"
            title={fullscreen ? "Exit fullscreen" : "Close AI panel"}
            aria-label={fullscreen ? "Exit fullscreen" : "Close AI panel"}
            onClick={() => setView(fullscreen ? "panel" : "collapsed")}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </header>

      <nav className="bw-ai-mode-tabs" aria-label="AI features">
        {AI_MODES.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="bw-ai-mode-tab"
            aria-pressed={mode === candidate.id}
            onClick={() => selectMode(candidate.id)}
          >
            <candidate.icon size={15} />
            <span>{candidate.label}</span>
          </button>
        ))}
      </nav>

      <div className="bw-ai-panel-scroll">
        <AIComposer />

        {error ? (
          <div className="bw-alert" role="alert">
            <strong>AI could not finish that request.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <AIOutput />

        {!fullscreen ? (
          <>
            <AIHistoryList />
            <DiagramCheck />
          </>
        ) : null}
      </div>
    </aside>
  );
}

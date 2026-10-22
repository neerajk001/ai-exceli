import { AI_MODES } from "./aiModes";
import { useAIWorkspace } from "./AIWorkspaceContext";
import { AIHistoryList } from "./AIHistoryList";
import { DiagramCheck } from "./DiagramCheck";
import { CollapseIcon, SparkleIcon } from "./icons";

export function AIWorkspaceRail() {
  const { mode, selectMode, setView } = useAIWorkspace();

  return (
    <aside className="bw-rail" aria-label="AI workspace navigation">
      <div className="bw-rail-head">
        <span className="bw-rail-logo">
          <SparkleIcon size={18} />
        </span>
        <div>
          <strong>AI Workspace</strong>
          <span>Build with context</span>
        </div>
      </div>

      <nav className="bw-rail-nav" aria-label="AI features">
        <p className="bw-rail-label">Features</p>
        {AI_MODES.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="bw-rail-mode"
            aria-current={mode === candidate.id ? "page" : undefined}
            onClick={() => selectMode(candidate.id)}
          >
            <span className="bw-rail-mode-icon">
              <candidate.icon size={17} />
            </span>
            {candidate.label}
          </button>
        ))}
      </nav>

      <div className="bw-rail-scroll">
        <AIHistoryList variant="rail" />
      </div>

      <div className="bw-rail-footer">
        <DiagramCheck />
        <button
          type="button"
          className="bw-rail-exit"
          onClick={() => setView("panel")}
        >
          <CollapseIcon size={15} /> Back to board
        </button>
      </div>
    </aside>
  );
}

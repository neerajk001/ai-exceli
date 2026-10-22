import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { Link } from "react-router-dom";

import { useAIWorkspace } from "../ai-panel/AIWorkspaceContext";
import { AIPanel } from "../ai-panel/AIPanel";
import { AIWorkspaceRail } from "../ai-panel/AIWorkspaceRail";
import { CloseIcon, SavedIcon, SparkleIcon } from "../ai-panel/icons";
import { Canvas } from "../canvas/Canvas";
import { BrandMark } from "../components/BrandMark";
import { BoardFileMenu } from "./BoardFileMenu";
import { TidyButton } from "./TidyButton";
import "./boardWorkspace.css";

export type SaveState = "idle" | "saving" | "saved" | "error";

type BoardWorkspaceProps = {
  title: string;
  onTitleChange: (value: string) => void;
  onTitleBlur: () => void;
  saveState: SaveState;
  onRetrySave: () => void;
  initialData: ExcalidrawInitialDataState | null;
  onSceneChange: (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
  ) => void;
};

const LAYOUTS = [
  { id: "split", label: "Split view" },
  { id: "canvas", label: "Canvas only" },
  { id: "output", label: "Output only" },
] as const;

function SaveBadge({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  if (state === "error") {
    return (
      <button
        type="button"
        className="bw-save bw-save-error"
        onClick={onRetry}
      >
        Save failed — retry
      </button>
    );
  }

  if (state === "saving") {
    return (
      <span className="bw-save bw-save-saving">
        <span className="bw-spinner" aria-hidden="true" /> Saving...
      </span>
    );
  }

  return (
    <span className="bw-save bw-save-saved">
      <SavedIcon size={14} /> {state === "saved" ? "Saved" : "All changes saved"}
    </span>
  );
}

function FullscreenControls() {
  const { fullscreenLayout, setFullscreenLayout, setView } = useAIWorkspace();

  return (
    <div className="bw-fullscreen-controls">
      <div className="bw-layout-switch" role="group" aria-label="AI workspace layout">
        {LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            aria-pressed={fullscreenLayout === layout.id}
            onClick={() => setFullscreenLayout(layout.id)}
          >
            {layout.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="bw-icon-btn bw-exit-fullscreen"
        aria-label="Exit fullscreen AI workspace"
        title="Exit fullscreen"
        onClick={() => setView("panel")}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

export function BoardWorkspace({
  title,
  onTitleChange,
  onTitleBlur,
  saveState,
  onRetrySave,
  initialData,
  onSceneChange,
}: BoardWorkspaceProps) {
  const { view, setView, fullscreenLayout } = useAIWorkspace();
  const fullscreen = view === "fullscreen";

  return (
    <div
      className="bw-shell"
      data-ai-view={view}
      data-fullscreen-layout={fullscreen ? fullscreenLayout : "split"}
    >
      <header className="bw-topbar">
        <div className="bw-topbar-left">
          <Link to="/boards" className="bw-brand" aria-label="Back to boards">
            <BrandMark size={30} />
            <span>TidyBoard</span>
          </Link>
          <span className="bw-topbar-slash" aria-hidden="true">
            /
          </span>
          <input
            className="bw-board-title"
            value={title}
            maxLength={120}
            aria-label="Board title"
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={onTitleBlur}
          />
          <SaveBadge state={saveState} onRetry={onRetrySave} />
        </div>

        <div className="bw-topbar-right">
          {fullscreen ? (
            <FullscreenControls />
          ) : (
            <button
              type="button"
              className={`bw-ai-open${view === "panel" ? " bw-ai-open-active" : ""}`}
              aria-pressed={view === "panel"}
              onClick={() =>
                setView(view === "panel" ? "collapsed" : "panel")
              }
            >
              <SparkleIcon size={15} /> AI
            </button>
          )}
          <div className="bw-topbar-tools">
            <TidyButton />
            <BoardFileMenu title={title} />
          </div>
        </div>
      </header>

      <div className="bw-body">
        {fullscreen ? <AIWorkspaceRail /> : null}
        <div className="bw-canvas-frame">
          <Canvas initialData={initialData} onChange={onSceneChange} />
        </div>
        <AIPanel />
      </div>
    </div>
  );
}

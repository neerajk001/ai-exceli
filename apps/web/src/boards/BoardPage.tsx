import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AIWorkspaceProvider } from "../ai-panel/AIWorkspaceContext";
import {
  getBoard,
  updateBoard,
  type Board,
  type BoardScene,
} from "../api-client/client";
import { CanvasApiProvider } from "../canvas/CanvasApiContext";
import { BoardWorkspace, type SaveState } from "./BoardWorkspace";

const AUTOSAVE_DELAY_MS = 2000;

export function BoardPage() {
  const { id = "" } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const lastSavedScene = useRef("");
  const pendingScene = useRef<BoardScene | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;

    setBoard(null);
    setError(null);
    setLoadFailed(false);

    getBoard(id)
      .then((loaded) => {
        if (!active) {
          return;
        }

        setBoard(loaded);
        setTitle(loaded.title);
        lastSavedScene.current = JSON.stringify(loaded.scene);
      })
      .catch((caught) => {
        if (!active) {
          return;
        }

        setLoadFailed(true);
        setError(
          caught instanceof Error ? caught.message : "Could not load the board.",
        );
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current);
      }

      const pending = pendingScene.current;

      if (pending) {
        void updateBoard(id, { scene: pending }).catch(() => undefined);
      }
    };
  }, [id]);

  const persistScene = useCallback(
    async (scene: BoardScene) => {
      setSaveState("saving");

      try {
        await updateBoard(id, { scene });
        lastSavedScene.current = JSON.stringify(scene);
        pendingScene.current = null;
        setSaveState("saved");
      } catch {
        pendingScene.current = scene;
        setSaveState("error");
      }
    },
    [id],
  );

  const handleSceneChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
    ) => {
      const scene: BoardScene = {
        elements: elements.filter((element) => !element.isDeleted),
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
      };

      if (JSON.stringify(scene) === lastSavedScene.current) {
        return;
      }

      pendingScene.current = scene;

      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current);
      }

      saveTimer.current = window.setTimeout(() => {
        const pending = pendingScene.current;

        if (pending) {
          void persistScene(pending);
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [persistScene],
  );

  const handleRetry = () => {
    const pending = pendingScene.current;

    if (pending) {
      void persistScene(pending);
    }
  };

  const saveTitle = async () => {
    if (!board) {
      return;
    }

    const nextTitle = title.trim();

    if (!nextTitle || nextTitle === board.title) {
      setTitle(board.title);
      return;
    }

    try {
      const updated = await updateBoard(id, { title: nextTitle });
      setBoard(updated);
      setTitle(updated.title);
    } catch {
      setError("Could not save the title.");
    }
  };

  if (loadFailed) {
    return (
      <main className="page">
        <p className="page-error">{error ?? "Could not load the board."}</p>
        <Link className="page-button" to="/boards">
          Back to boards
        </Link>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="page">
        <p className="page-muted">Loading board...</p>
      </main>
    );
  }

  const initialData = {
    elements: board.scene.elements,
    appState: board.scene.appState,
  } as unknown as ExcalidrawInitialDataState;

  return (
    <CanvasApiProvider>
      <AIWorkspaceProvider>
        <BoardWorkspace
          title={title}
          onTitleChange={setTitle}
          onTitleBlur={() => void saveTitle()}
          saveState={saveState}
          onRetrySave={handleRetry}
          initialData={initialData}
          onSceneChange={handleSceneChange}
        />
      </AIWorkspaceProvider>
    </CanvasApiProvider>
  );
}

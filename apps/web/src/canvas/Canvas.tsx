import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { excalidrawToGraph } from "@wb/scene-graph";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSetCanvasApi } from "./CanvasApiContext";
import { loadScene, saveScene } from "./storage";

const SAVE_DEBOUNCE_MS = 500;

export function Canvas() {
  const setApi = useSetCanvasApi();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const [elementCount, setElementCount] = useState(0);
  const [initialData] = useState(() => loadScene());

  const handleExcalidrawApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      setApi(api);
      setElementCount(api.getSceneElements().length);
    },
    [setApi],
  );

  const handleChange = useCallback(() => {
    setElementCount(apiRef.current?.getSceneElements().length ?? 0);

    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(() => {
      const elements = apiRef.current?.getSceneElements();

      if (elements) {
        saveScene(elements);
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const handleLogGraph = useCallback(() => {
    const elements = apiRef.current?.getSceneElements();

    if (!elements) {
      return;
    }

    console.log("canvas graph", excalidrawToGraph(elements));
  }, []);

  return (
    <div className="canvas-wrapper">
      <Excalidraw
        excalidrawAPI={handleExcalidrawApi}
        initialData={initialData}
        onChange={handleChange}
      />
      <div className="canvas-debug">elements: {elementCount}</div>
      {import.meta.env.DEV ? (
        <button
          type="button"
          className="canvas-log-graph"
          onClick={handleLogGraph}
        >
          Log graph
        </button>
      ) : null}
    </div>
  );
}

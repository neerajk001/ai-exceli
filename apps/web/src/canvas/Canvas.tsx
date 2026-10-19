import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useCallback, useRef, useState } from "react";

import { useSetCanvasApi } from "./CanvasApiContext";

type CanvasProps = {
  initialData: ExcalidrawInitialDataState | null;
  onChange?: (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
  ) => void;
};

export function Canvas({ initialData, onChange }: CanvasProps) {
  const setApi = useSetCanvasApi();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [elementCount, setElementCount] = useState(0);

  const handleExcalidrawApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      setApi(api);
      setElementCount(api.getSceneElements().length);
    },
    [setApi],
  );

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
    ) => {
      setElementCount(elements.length);
      onChange?.(elements, appState);
    },
    [onChange],
  );

  return (
    <div className="canvas-wrapper">
      <Excalidraw
        excalidrawAPI={handleExcalidrawApi}
        initialData={initialData}
        onChange={handleChange}
      />
      {import.meta.env.DEV ? (
        <div className="canvas-debug">elements: {elementCount}</div>
      ) : null}
    </div>
  );
}

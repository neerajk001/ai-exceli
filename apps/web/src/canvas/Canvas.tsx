import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const fittedInitialView = useRef(false);
  const [elementCount, setElementCount] = useState(0);
  const shouldFitInitialView = (initialData?.elements?.length ?? 0) > 0;

  const handleExcalidrawApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      setApi(api);
      setElementCount(api.getSceneElements().length);
    },
    [setApi],
  );

  useEffect(() => {
    if (
      !shouldFitInitialView ||
      fittedInitialView.current ||
      elementCount === 0
    ) {
      return undefined;
    }

    const api = apiRef.current;

    if (!api) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const elements = api.getSceneElements();

      if (elements.length === 0) {
        return;
      }

      fittedInitialView.current = true;
      api.scrollToContent(elements, {
        fitToViewport: true,
        animate: false,
      });
    }, 160);

    return () => window.clearTimeout(timer);
  }, [elementCount, shouldFitInitialView]);

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

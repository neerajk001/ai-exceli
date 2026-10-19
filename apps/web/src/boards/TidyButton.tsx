import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { excalidrawToGraph } from "@wb/scene-graph";
import { useState } from "react";

import { useCanvasApi } from "../canvas/CanvasApiContext";
import { tidyBoard } from "../canvas/tidyBoard";

export function TidyButton() {
  const api = useCanvasApi();
  const [status, setStatus] = useState<string | null>(null);

  const handleClick = () => {
    if (!api) {
      setStatus("Canvas is still loading...");
      return;
    }

    const elements = api.getSceneElements();
    const result = tidyBoard(elements, excalidrawToGraph(elements));

    if (result.ops.length === 0) {
      setStatus("Already tidy");
      return;
    }

    api.updateScene({
      elements: result.elements as unknown as OrderedExcalidrawElement[],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setStatus(`Aligned ${result.ops.length - result.skipped} shapes`);
  };

  return (
    <>
      <button
        type="button"
        className="page-button"
        disabled={!api}
        onClick={handleClick}
      >
        Tidy board
      </button>
      {status ? <span className="save-status">{status}</span> : null}
    </>
  );
}

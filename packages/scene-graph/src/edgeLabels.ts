import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export const EDGE_LABEL_ARROW_ID = "edgeLabelFor";

export function edgeLabelArrowId(
  element: ExcalidrawElement,
): string | undefined {
  const customData = element.customData as
    | Record<string, unknown>
    | null
    | undefined;
  const arrowId = customData?.[EDGE_LABEL_ARROW_ID];

  return typeof arrowId === "string" && arrowId.length > 0
    ? arrowId
    : undefined;
}

export function edgeLabelCustomData(
  arrowId: string,
): Record<string, unknown> {
  return { [EDGE_LABEL_ARROW_ID]: arrowId };
}

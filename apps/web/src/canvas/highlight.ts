import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Selects the given elements and brings them into view.
 * Returns the ids that were actually highlighted.
 */
export function highlightElements(
  api: ExcalidrawImperativeAPI,
  elementIds: readonly string[],
): string[] {
  if (elementIds.length === 0) {
    return [];
  }

  const wanted = new Set(elementIds);
  const elements = api
    .getSceneElements()
    .filter((element) => wanted.has(element.id));

  if (elements.length === 0) {
    return [];
  }

  const selectedElementIds: Record<string, true> = {};
  for (const element of elements) {
    selectedElementIds[element.id] = true;
  }

  api.updateScene({ appState: { selectedElementIds } });
  api.scrollToContent(elements, { fitToViewport: true });

  return elements.map((element) => element.id);
}

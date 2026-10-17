import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { describe, expect, it, vi } from "vitest";

import { highlightElements } from "./highlight";

function fakeApi(elements: { id: string }[]) {
  const updateScene = vi.fn();
  const scrollToContent = vi.fn();

  const api = {
    getSceneElements: () => elements,
    updateScene,
    scrollToContent,
  } as unknown as ExcalidrawImperativeAPI;

  return { api, updateScene, scrollToContent };
}

describe("highlightElements", () => {
  it("selects the requested elements and fits them into the viewport", () => {
    const { api, updateScene, scrollToContent } = fakeApi([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);

    const highlighted = highlightElements(api, ["a", "c"]);

    expect(highlighted).toEqual(["a", "c"]);
    expect(updateScene).toHaveBeenCalledWith({
      appState: { selectedElementIds: { a: true, c: true } },
    });
    expect(scrollToContent).toHaveBeenCalledWith([{ id: "a" }, { id: "c" }], {
      fitToViewport: true,
    });
  });

  it("does nothing when none of the ids are on the canvas", () => {
    const { api, updateScene, scrollToContent } = fakeApi([{ id: "a" }]);

    expect(highlightElements(api, ["ghost"])).toEqual([]);
    expect(updateScene).not.toHaveBeenCalled();
    expect(scrollToContent).not.toHaveBeenCalled();
  });

  it("does nothing for an empty id list", () => {
    const { api, updateScene, scrollToContent } = fakeApi([{ id: "a" }]);

    expect(highlightElements(api, [])).toEqual([]);
    expect(updateScene).not.toHaveBeenCalled();
    expect(scrollToContent).not.toHaveBeenCalled();
  });
});

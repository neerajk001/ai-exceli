import { describe, expect, it } from "vitest";

import {
  buildSceneDocument,
  parseSceneFile,
  sanitizeFilename,
} from "./sceneFile";

describe("sanitizeFilename", () => {
  it("replaces characters that are invalid in filenames", () => {
    expect(sanitizeFilename('my/board: "v1" ?*')).toBe("my-board- -v1- --");
  });

  it("falls back to a default name", () => {
    expect(sanitizeFilename("   ")).toBe("board");
  });

  it("truncates long names", () => {
    expect(sanitizeFilename("a".repeat(200))).toHaveLength(80);
  });
});

describe("parseSceneFile", () => {
  it("accepts an Excalidraw scene", () => {
    const scene = parseSceneFile(
      JSON.stringify({
        type: "excalidraw",
        elements: [{ id: "a", type: "rectangle" }],
        appState: { viewBackgroundColor: "#fff" },
      }),
    );

    expect(scene?.elements).toHaveLength(1);
    expect(scene?.appState).toEqual({ viewBackgroundColor: "#fff" });
  });

  it("rejects invalid JSON", () => {
    expect(parseSceneFile("not json")).toBeNull();
  });

  it("rejects a missing or invalid elements array", () => {
    expect(parseSceneFile(JSON.stringify({}))).toBeNull();
    expect(parseSceneFile(JSON.stringify({ elements: "nope" }))).toBeNull();
    expect(parseSceneFile(JSON.stringify({ elements: [1, 2] }))).toBeNull();
  });
});

describe("buildSceneDocument", () => {
  it("wraps elements in an Excalidraw document", () => {
    const document = buildSceneDocument(
      [{ id: "a" }],
      { viewBackgroundColor: "#fff" },
      {},
    );

    expect(document.type).toBe("excalidraw");
    expect(document.elements).toEqual([{ id: "a" }]);
    expect(document.source).toBe("ai-whiteboard");
  });
});

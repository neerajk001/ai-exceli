import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Op } from "@wb/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { playOps } from "./playOps";

type UpdateCall = {
  elements?: readonly ExcalidrawElement[];
  appState?: { viewModeEnabled?: boolean };
  collaborators?: Map<string, unknown>;
  captureUpdate?: string;
};

function rectangle(id: string, x: number, y: number): ExcalidrawElement {
  return {
    id,
    type: "rectangle",
    x,
    y,
    width: 120,
    height: 60,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: id.length,
    isDeleted: false,
    boundElements: [],
    updated: 0,
    link: null,
    locked: false,
  } as unknown as ExcalidrawElement;
}

function createMockApi(initial: ExcalidrawElement[]) {
  let elements: readonly ExcalidrawElement[] = initial;
  let appState = {
    viewModeEnabled: false,
    collaborators: new Map<string, unknown>(),
  };
  const calls: UpdateCall[] = [];

  const api = {
    getSceneElements: () => elements,
    getAppState: () => appState,
    updateScene: (data: UpdateCall) => {
      calls.push(data);

      if (data.elements) {
        elements = data.elements;
      }
      if (data.appState) {
        appState = { ...appState, ...data.appState };
      }
      if (data.collaborators) {
        appState = { ...appState, collaborators: data.collaborators };
      }
    },
  } as unknown as ExcalidrawImperativeAPI;

  return {
    api,
    calls,
    getElements: () => elements,
    getAppState: () => appState,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("playOps", () => {
  it("plays one op at a time, commits once, and clears the cursor", async () => {
    vi.useFakeTimers();
    const { api, calls } = createMockApi([
      rectangle("a", 0, 0),
      rectangle("b", 400, 0),
    ]);
    const ops: Op[] = [
      { type: "update_node", id: "a", patch: { x: 20, y: 20 } },
      {
        type: "add_node",
        node: { id: "new_1", kind: "rectangle", text: "Cache" },
      },
      { type: "delete", id: "b" },
    ];

    const promise = playOps({ api, ops, moveDurationMs: 100, pauseMs: 50 });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toEqual({ applied: 3, skipped: 0, cancelled: false });

    const steps = calls.filter(
      (call) => call.elements && call.captureUpdate === "EVENTUALLY",
    );
    expect(steps).toHaveLength(3);

    const captures = calls.filter(
      (call) => call.captureUpdate === "IMMEDIATELY",
    );
    expect(captures).toHaveLength(1);

    const cursorCalls = calls.filter(
      (call) => call.collaborators !== undefined,
    );
    expect(cursorCalls.length).toBeGreaterThan(0);
    expect(cursorCalls[cursorCalls.length - 1]?.collaborators?.size).toBe(0);

    const firstCursorIndex = calls.findIndex(
      (call) => call.collaborators !== undefined,
    );
    const firstStepIndex = calls.findIndex(
      (call) => call.captureUpdate === "EVENTUALLY",
    );
    expect(firstCursorIndex).toBeLessThan(firstStepIndex);

    const viewModeCalls = calls.filter(
      (call) => call.appState?.viewModeEnabled !== undefined,
    );
    expect(viewModeCalls[0]?.appState?.viewModeEnabled).toBe(true);
    expect(viewModeCalls[viewModeCalls.length - 1]?.appState?.viewModeEnabled).toBe(
      false,
    );
  });

  it("cancels cleanly on abort and leaves the board consistent", async () => {
    vi.useFakeTimers();
    const { api, calls, getElements, getAppState } = createMockApi([
      rectangle("a", 0, 0),
      rectangle("b", 400, 0),
    ]);
    const ops: Op[] = [
      { type: "update_node", id: "a", patch: { x: 20, y: 20 } },
      { type: "delete", id: "b" },
    ];
    const controller = new AbortController();

    const promise = playOps({
      api,
      ops,
      signal: controller.signal,
      moveDurationMs: 50,
      pauseMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(120);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.cancelled).toBe(true);
    expect(result.applied).toBe(1);

    const ids = getElements().map((element) => element.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(getAppState().viewModeEnabled).toBe(false);

    const cursorCalls = calls.filter(
      (call) => call.collaborators !== undefined,
    );
    expect(cursorCalls[cursorCalls.length - 1]?.collaborators?.size).toBe(0);

    const captures = calls.filter(
      (call) => call.captureUpdate === "IMMEDIATELY",
    );
    expect(captures).toHaveLength(1);
  });

  it("reports skipped ops but keeps playing", async () => {
    vi.useFakeTimers();
    const { api } = createMockApi([rectangle("a", 0, 0)]);

    const promise = playOps({
      api,
      ops: [{ type: "delete", id: "ghost" }],
      moveDurationMs: 0,
      pauseMs: 0,
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toEqual({ applied: 1, skipped: 1, cancelled: false });
  });
});

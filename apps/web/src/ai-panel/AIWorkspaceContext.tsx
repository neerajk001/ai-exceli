import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  chooseLayoutType,
  layoutWithKind,
  placeNewNodes,
  tidy,
  type LayoutKind,
} from "@wb/layout";
import { applyOps, excalidrawToGraph } from "@wb/scene-graph";
import type { AIResponse, CodeTarget, Graph, Op } from "@wb/shared-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { playOps } from "../ai-cursor/playOps";
import { useCanvasApi } from "../canvas/CanvasApiContext";
import { exportSceneImageBase64 } from "../canvas/exportImage";
import { highlightElements } from "../canvas/highlight";
import { defaultOutputTab, type AIMode } from "./aiModes";
import { useAI } from "./useAI";

export type AIView = "collapsed" | "panel" | "fullscreen";
export type FullscreenLayout = "split" | "canvas" | "output";
export type OutputTab = "code" | "documentation" | "explanation" | "next";
export type ChangeStatus = "complete" | "pending" | "applied" | "cancelled";

export type AIHistoryEntry = {
  id: string;
  mode: AIMode;
  prompt: string;
  target?: CodeTarget;
  createdAt: number;
  graph: Graph;
  answer?: string;
  code?: { language: string; content: string };
  highlightIds?: string[];
  opsCount?: number;
  status: ChangeStatus;
};

type PendingChange = {
  entryId: string;
  mode: AIMode;
  ops: Op[];
  layoutKind?: LayoutKind;
  fitToViewport?: boolean;
};

type AIWorkspaceValue = {
  view: AIView;
  setView: (view: AIView) => void;
  fullscreenLayout: FullscreenLayout;
  setFullscreenLayout: (layout: FullscreenLayout) => void;
  mode: AIMode;
  selectMode: (mode: AIMode) => void;
  input: string;
  setInput: (value: string) => void;
  target: CodeTarget;
  setTarget: (target: CodeTarget) => void;
  recognizeStrokes: boolean;
  setRecognizeStrokes: (value: boolean) => void;
  watchAI: boolean;
  setWatchAI: (value: boolean) => void;
  loading: boolean;
  playing: boolean;
  busy: boolean;
  error: string | null;
  hint: string | null;
  submit: () => Promise<void>;
  cancelActive: () => void;
  stopPlayback: () => void;
  pending: PendingChange | null;
  applyPending: () => Promise<void>;
  cancelPending: () => void;
  history: AIHistoryEntry[];
  activeEntry: AIHistoryEntry | null;
  activeEntryId: string | null;
  selectHistory: (entry: AIHistoryEntry) => void;
  outputTab: OutputTab;
  setOutputTab: (tab: OutputTab) => void;
};

const AIWorkspaceContext = createContext<AIWorkspaceValue | null>(null);

const MAX_HISTORY = 30;

export function AIWorkspaceProvider({ children }: { children: ReactNode }) {
  const api = useCanvasApi();
  const ai = useAI();
  const [view, setView] = useState<AIView>("collapsed");
  const [fullscreenLayout, setFullscreenLayout] =
    useState<FullscreenLayout>("split");
  const [mode, setMode] = useState<AIMode>("ask");
  const [inputs, setInputs] = useState<Record<AIMode, string>>({
    ask: "",
    toCode: "",
    generate: "",
    cleanup: "",
    collaborate: "",
  });
  const [target, setTarget] = useState<CodeTarget>("prisma");
  const [recognizeStrokes, setRecognizeStrokes] = useState(false);
  const [watchAI, setWatchAI] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [history, setHistory] = useState<AIHistoryEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>("explanation");
  const [pending, setPending] = useState<PendingChange | null>(null);
  const playbackRef = useRef<AbortController | null>(null);
  const entryCounter = useRef(0);

  const input = inputs[mode];
  const busy = ai.loading || playing;

  useEffect(() => {
    return () => {
      playbackRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView((current) => (current === "collapsed" ? "panel" : current));
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const setInput = useCallback(
    (value: string) => {
      setInputs((previous) => ({ ...previous, [mode]: value }));
    },
    [mode],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<AIHistoryEntry>) => {
      setHistory((previous) =>
        previous.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry,
        ),
      );
    },
    [],
  );

  const addEntry = useCallback((entry: AIHistoryEntry) => {
    setHistory((previous) => [entry, ...previous].slice(0, MAX_HISTORY));
    setActiveEntryId(entry.id);
  }, []);

  const activeEntry = useMemo(
    () => history.find((entry) => entry.id === activeEntryId) ?? null,
    [activeEntryId, history],
  );

  const selectMode = useCallback(
    (next: AIMode) => {
      setMode(next);
      setHint(null);
      setOutputTab(defaultOutputTab(next));
      setActiveEntryId((current) => {
        const selected = history.find((entry) => entry.id === current);

        if (selected?.mode === next) {
          return current;
        }

        return history.find((entry) => entry.mode === next)?.id ?? null;
      });
    },
    [history],
  );

  const selectHistory = useCallback(
    (entry: AIHistoryEntry) => {
      setActiveEntryId(entry.id);
      setMode(entry.mode);
      setOutputTab(
        entry.code
          ? "code"
          : entry.answer
            ? "explanation"
            : defaultOutputTab(entry.mode),
      );
      setView((current) => (current === "collapsed" ? "panel" : current));
    },
    [],
  );

  const stopPlayback = useCallback(() => {
    playbackRef.current?.abort();
  }, []);

  const cancelActive = useCallback(() => {
    if (playing) {
      playbackRef.current?.abort();
      return;
    }

    ai.cancel();
  }, [ai, playing]);

  const startPlayback = useCallback(
    async (
      ops: Op[],
      options: { fitToViewport?: boolean; layout?: LayoutKind } = {},
      entryId?: string,
    ) => {
      if (!api || ops.length === 0) {
        return;
      }

      const controller = new AbortController();
      playbackRef.current = controller;
      setPlaying(true);
      setHint("AI is drawing...");

      try {
        const played = await playOps({
          api,
          ops,
          signal: controller.signal,
          ...(options.fitToViewport ? { fitToViewport: true } : {}),
          ...(options.layout ? { layout: layoutWithKind(options.layout) } : {}),
        });

        if (entryId) {
          updateEntry(entryId, {
            status:
              played.cancelled && played.applied === 0 ? "cancelled" : "applied",
            opsCount: played.applied,
          });
        }

        if (played.cancelled) {
          setHint(`stopped after ${played.applied} ops`);
        } else {
          const skipped =
            played.skipped > 0 ? `, skipped ${played.skipped}` : "";
          setHint(`applied ${played.applied} ops${skipped}`);
        }
      } catch {
        setHint("Playback failed.");

        if (entryId) {
          updateEntry(entryId, { status: "cancelled" });
        }
      } finally {
        playbackRef.current = null;
        setPlaying(false);
        setPending((current) =>
          entryId && current?.entryId === entryId ? null : current,
        );
      }
    },
    [api, updateEntry],
  );

  const applyPending = useCallback(async () => {
    if (!pending || !api) {
      return;
    }

    if (pending.mode === "cleanup") {
      const applied = applyOps(api.getSceneElements(), pending.ops, {
        layout: placeNewNodes,
        preserveGivenGeometry: true,
      });

      api.updateScene({
        elements: applied.elements as unknown as OrderedExcalidrawElement[],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      const appliedCount = pending.ops.length - applied.skipped.length;
      const skipped =
        applied.skipped.length > 0
          ? `, skipped ${applied.skipped.length}`
          : "";
      updateEntry(pending.entryId, {
        status: "applied",
        opsCount: appliedCount,
      });
      setHint(`applied ${appliedCount}/${pending.ops.length} ops${skipped}`);
      setPending(null);
      return;
    }

    await startPlayback(
      pending.ops,
      {
        ...(pending.fitToViewport ? { fitToViewport: true } : {}),
        ...(pending.layoutKind ? { layout: pending.layoutKind } : {}),
      },
      pending.entryId,
    );
  }, [api, pending, startPlayback, updateEntry]);

  const cancelPending = useCallback(() => {
    if (!pending) {
      return;
    }

    updateEntry(pending.entryId, { status: "cancelled" });
    setPending(null);
    setHint("Changes discarded.");
  }, [pending, updateEntry]);

  const makeEntry = (
    entryMode: AIMode,
    prompt: string,
    graph: Graph,
    response: AIResponse,
    status: ChangeStatus,
  ): AIHistoryEntry => {
    entryCounter.current += 1;

    return {
      id: `ai-${Date.now()}-${entryCounter.current}`,
      mode: entryMode,
      prompt,
      ...(entryMode === "toCode" ? { target } : {}),
      createdAt: Date.now(),
      graph,
      status,
      ...(response.answer?.trim() ? { answer: response.answer } : {}),
      ...(response.code ? { code: response.code } : {}),
      ...(response.highlightIds?.length
        ? { highlightIds: response.highlightIds }
        : {}),
      ...(response.ops?.length ? { opsCount: response.ops.length } : {}),
    };
  };

  const submit = async () => {
    if (busy) {
      return;
    }

    if (pending) {
      setHint("Apply or cancel the pending changes first.");
      return;
    }

    if (!api) {
      setHint("Canvas is still loading...");
      return;
    }

    const graph = excalidrawToGraph(api.getSceneElements());

    if (graph.nodes.length === 0 && mode !== "generate") {
      setHint("Draw something first.");
      return;
    }

    setHint(null);
    const prompt = input.trim();

    if (mode === "ask") {
      if (!prompt) {
        return;
      }

      const response = await ai.ask(graph, prompt);

      if (!response) {
        return;
      }

      const entry = makeEntry("ask", prompt, graph, response, "complete");
      addEntry(entry);
      setOutputTab(response.code ? "code" : "explanation");

      if (response.highlightIds && response.highlightIds.length > 0) {
        highlightElements(api, response.highlightIds);
      }

      return;
    }

    if (mode === "toCode") {
      const response = await ai.toCode(graph, target);

      if (!response) {
        return;
      }

      const entry = makeEntry(
        "toCode",
        `Generate ${target} code`,
        graph,
        response,
        "complete",
      );
      addEntry(entry);
      setOutputTab("code");
      return;
    }

    if (mode === "generate") {
      if (!prompt) {
        return;
      }

      const response = await ai.generate(graph, prompt);

      if (!response) {
        return;
      }

      const hasOps = Boolean(response.ops?.length);
      const entry = makeEntry(
        "generate",
        prompt,
        graph,
        response,
        hasOps ? "pending" : "complete",
      );
      addEntry(entry);
      setOutputTab(hasOps ? "next" : "explanation");

      if (response.ops?.length) {
        const schemaLayout = response.ops.some(
          (op) =>
            op.type === "add_node" && (op.node.fields?.length ?? 0) > 0,
        );
        let layoutKind = schemaLayout ? "schema" : chooseLayoutType(prompt);

        if (schemaLayout && api) {
          for (const candidate of [
            "schema",
            "architecture",
            "flowchart",
          ] as const) {
            const preview = applyOps(api.getSceneElements(), response.ops, {
              layout: layoutWithKind(candidate),
            });

            if (preview.layoutIssues.length === 0) {
              layoutKind = candidate;
              break;
            }
          }
        }

        setPending({
          entryId: entry.id,
          mode: "generate",
          ops: response.ops,
          ...(layoutKind ? { layoutKind } : {}),
          ...(graph.nodes.length === 0 || schemaLayout
            ? { fitToViewport: true }
            : {}),
        });
        setHint(
          `${response.ops.length} changes ready. Apply them to the canvas.`,
        );
      }

      return;
    }

    if (mode === "collaborate") {
      if (!prompt) {
        return;
      }

      const response = await ai.collaborate(graph, prompt);

      if (!response) {
        return;
      }

      const hasOps = Boolean(response.ops?.length);
      const entry = makeEntry(
        "collaborate",
        prompt,
        graph,
        response,
        hasOps ? "pending" : "complete",
      );
      addEntry(entry);
      setOutputTab(hasOps ? "next" : "explanation");

      if (response.ops?.length) {
        setPending({
          entryId: entry.id,
          mode: "collaborate",
          ops: response.ops,
        });
        setHint(
          `${response.ops.length} changes ready. Apply them to the canvas.`,
        );
      }

      return;
    }

    let imageBase64: string | undefined;

    if (recognizeStrokes) {
      setHint("Exporting the canvas...");

      try {
        imageBase64 = await exportSceneImageBase64(api);
      } catch {
        setHint("Could not export the canvas image.");
        return;
      }
    }

    const response = await ai.cleanup(graph, imageBase64);

    if (!response) {
      setHint(null);
      return;
    }

    const tidyOps = tidy(graph);
    const ops: Op[] = [...(response.ops ?? []), ...tidyOps];

    if (ops.length === 0) {
      const entry = makeEntry(
        "cleanup",
        "Clean up diagram",
        graph,
        response,
        "complete",
      );
      addEntry(entry);
      setOutputTab("next");
      setHint("Nothing to clean up.");
      return;
    }

    if (watchAI) {
      const entry = makeEntry(
        "cleanup",
        "Clean up diagram",
        graph,
        response,
        "pending",
      );
      addEntry(entry);
      setOutputTab("next");
      await startPlayback(ops, {}, entry.id);
      return;
    }

    const entry = makeEntry(
      "cleanup",
      "Clean up diagram",
      graph,
      response,
      "pending",
    );
    addEntry(entry);
    setOutputTab("next");
    setPending({
      entryId: entry.id,
      mode: "cleanup",
      ops,
    });
    setHint(`${ops.length} changes ready. Apply them to the canvas.`);
  };

  const value: AIWorkspaceValue = {
    view,
    setView,
    fullscreenLayout,
    setFullscreenLayout,
    mode,
    selectMode,
    input,
    setInput,
    target,
    setTarget,
    recognizeStrokes,
    setRecognizeStrokes,
    watchAI,
    setWatchAI,
    loading: ai.loading,
    playing,
    busy,
    error: ai.error,
    hint,
    submit,
    cancelActive,
    stopPlayback,
    pending,
    applyPending,
    cancelPending,
    history,
    activeEntry,
    activeEntryId,
    selectHistory,
    outputTab,
    setOutputTab,
  };

  return (
    <AIWorkspaceContext.Provider value={value}>
      {children}
    </AIWorkspaceContext.Provider>
  );
}

export function useAIWorkspace(): AIWorkspaceValue {
  const value = useContext(AIWorkspaceContext);

  if (!value) {
    throw new Error("useAIWorkspace must be used within AIWorkspaceProvider");
  }

  return value;
}

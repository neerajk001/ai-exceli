import type { AIResponse, CodeTarget, Graph } from "@wb/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { askAI, toCode } from "../api-client/client";

export type AIState = {
  loading: boolean;
  error: string | null;
  result: AIResponse | null;
};

export function useAI() {
  const [state, setState] = useState<AIState>({
    loading: false,
    error: null,
    result: null,
  });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState((previous) => ({ ...previous, loading: false }));
  }, []);

  const run = useCallback(
    async (
      invoke: (signal: AbortSignal) => Promise<AIResponse>,
    ): Promise<AIResponse | null> => {
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ loading: true, error: null, result: null });

      try {
        const result = await invoke(controller.signal);

        setState({ loading: false, error: null, result });
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return null;
        }

        setState({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
          result: null,
        });
        return null;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    [],
  );

  const ask = useCallback(
    (graph: Graph, question: string) =>
      run((signal) =>
        askAI({ mode: "ask", graph, input: question }, { signal }),
      ),
    [run],
  );

  const generateCode = useCallback(
    (graph: Graph, target: CodeTarget) =>
      run((signal) =>
        toCode({ mode: "toCode", graph, input: target }, { signal }),
      ),
    [run],
  );

  return { ...state, ask, toCode: generateCode, cancel };
}

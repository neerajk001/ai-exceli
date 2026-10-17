import type { AIResponse, Graph } from "@wb/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { askAI } from "../api-client/client";

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

  const ask = useCallback(
    async (graph: Graph, input: string): Promise<AIResponse | null> => {
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ loading: true, error: null, result: null });

      try {
        const result = await askAI(
          { mode: "ask", graph, input },
          { signal: controller.signal },
        );

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

  return { ...state, ask, cancel };
}

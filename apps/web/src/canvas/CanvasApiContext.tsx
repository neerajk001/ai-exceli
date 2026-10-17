import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CanvasApiContextValue = {
  api: ExcalidrawImperativeAPI | null;
  setApi: (api: ExcalidrawImperativeAPI | null) => void;
};

const CanvasApiContext = createContext<CanvasApiContextValue | null>(null);

export function CanvasApiProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);

  const value = useMemo<CanvasApiContextValue>(() => ({ api, setApi }), [api]);

  return (
    <CanvasApiContext.Provider value={value}>
      {children}
    </CanvasApiContext.Provider>
  );
}

function useCanvasApiContext(): CanvasApiContextValue {
  const context = useContext(CanvasApiContext);

  if (!context) {
    throw new Error("useCanvasApi must be used within a CanvasApiProvider");
  }

  return context;
}

export function useCanvasApi(): ExcalidrawImperativeAPI | null {
  return useCanvasApiContext().api;
}

export function useSetCanvasApi(): (
  api: ExcalidrawImperativeAPI | null,
) => void {
  return useCanvasApiContext().setApi;
}

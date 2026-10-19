import { AIPanel } from "./ai-panel/AIPanel";
import { Canvas } from "./canvas/Canvas";
import { CanvasApiProvider } from "./canvas/CanvasApiContext";
import { DevOpsPanel } from "./dev/DevOpsPanel";

export function App() {
  return (
    <CanvasApiProvider>
      <div className="app-shell">
        <div className="canvas-area">
          <Canvas />
          {import.meta.env.DEV ? <DevOpsPanel /> : null}
        </div>
        <AIPanel />
      </div>
    </CanvasApiProvider>
  );
}

import { AIPanel } from "./ai-panel/AIPanel";
import { Canvas } from "./canvas/Canvas";
import { CanvasApiProvider } from "./canvas/CanvasApiContext";

export function App() {
  return (
    <CanvasApiProvider>
      <div className="app-shell">
        <div className="canvas-area">
          <Canvas />
        </div>
        <AIPanel />
      </div>
    </CanvasApiProvider>
  );
}

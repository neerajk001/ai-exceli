import { Canvas } from "./canvas/Canvas";
import { CanvasApiProvider } from "./canvas/CanvasApiContext";

export function App() {
  return (
    <CanvasApiProvider>
      <div className="app-shell">
        <div className="canvas-area">
          <Canvas />
        </div>
        <aside className="ai-panel" aria-label="AI panel" />
      </div>
    </CanvasApiProvider>
  );
}

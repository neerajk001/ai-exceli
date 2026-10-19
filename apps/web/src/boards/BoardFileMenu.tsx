import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useRef, useState, type ChangeEvent } from "react";

import { useCanvasApi } from "../canvas/CanvasApiContext";
import { exportBoard, type ExportFormat } from "../canvas/exportScene";
import { MAX_IMPORT_BYTES, parseSceneFile } from "../canvas/sceneFile";

const FORMATS: ExportFormat[] = ["png", "svg", "json"];

export function BoardFileMenu({ title }: { title: string }) {
  const api = useCanvasApi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    if (!api || busy) {
      return;
    }

    setBusy(true);
    setStatus("Exporting...");

    try {
      await exportBoard(api, title, format);
      setStatus("Exported");
    } catch {
      setStatus("Export failed");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !api) {
      return;
    }

    if (file.size > MAX_IMPORT_BYTES) {
      setStatus("File is too large (max 5 MB)");
      return;
    }

    const scene = parseSceneFile(await file.text());

    if (!scene) {
      setStatus("Not a valid .excalidraw file");
      return;
    }

    const viewBackgroundColor = scene.appState?.viewBackgroundColor;

    api.updateScene({
      elements: scene.elements as unknown as OrderedExcalidrawElement[],
      ...(typeof viewBackgroundColor === "string"
        ? { appState: { viewBackgroundColor } }
        : {}),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setStatus(`Imported ${scene.elements.length} elements`);
  };

  return (
    <>
      <select
        className="file-format"
        value={format}
        disabled={busy}
        aria-label="Export format"
        onChange={(event) => setFormat(event.target.value as ExportFormat)}
      >
        {FORMATS.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate.toUpperCase()}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="page-button"
        disabled={!api || busy}
        onClick={() => void handleExport()}
      >
        Export
      </button>
      <button
        type="button"
        className="page-button"
        disabled={!api}
        onClick={() => inputRef.current?.click()}
      >
        Import
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".excalidraw,.json,application/json"
        hidden
        onChange={(event) => void handleImport(event)}
      />
      {status ? <span className="save-status">{status}</span> : null}
    </>
  );
}

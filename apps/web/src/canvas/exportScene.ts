import { exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  buildSceneDocument,
  sanitizeFilename,
  type SceneDocument,
} from "./sceneFile";

export type ExportFormat = "png" | "svg" | "json";

export async function exportBoard(
  api: ExcalidrawImperativeAPI,
  title: string,
  format: ExportFormat,
): Promise<void> {
  const name = sanitizeFilename(title);

  if (format === "json") {
    download(
      new Blob([JSON.stringify(sceneDocument(api), null, 2)], {
        type: "application/json",
      }),
      `${name}.excalidraw`,
    );
    return;
  }

  if (format === "svg") {
    const svg = await exportToSvg(exportOptions(api));

    download(
      new Blob([svg.outerHTML], { type: "image/svg+xml" }),
      `${name}.svg`,
    );
    return;
  }

  const blob = await exportToBlob({
    ...exportOptions(api),
    mimeType: "image/png",
    maxWidthOrHeight: 2048,
  });

  download(blob, `${name}.png`);
}

function exportOptions(api: ExcalidrawImperativeAPI) {
  return {
    elements: api.getSceneElements(),
    appState: {
      exportBackground: true,
      viewBackgroundColor: api.getAppState().viewBackgroundColor,
    },
    files: api.getFiles(),
  };
}

function sceneDocument(api: ExcalidrawImperativeAPI): SceneDocument {
  return buildSceneDocument(
    api.getSceneElements(),
    { viewBackgroundColor: api.getAppState().viewBackgroundColor },
    api.getFiles() as unknown as Record<string, unknown>,
  );
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

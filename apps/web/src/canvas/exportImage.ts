import { exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const MAX_SIDE = 1024;

export async function exportSceneImageBase64(
  api: ExcalidrawImperativeAPI,
): Promise<string> {
  const appState = api.getAppState();

  const blob = await exportToBlob({
    elements: api.getSceneElements(),
    appState: {
      exportBackground: true,
      viewBackgroundColor: appState.viewBackgroundColor,
    },
    files: api.getFiles(),
    maxWidthOrHeight: MAX_SIDE,
    mimeType: "image/png",
  });

  const dataUrl = await readAsDataUrl(blob);

  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not read the exported image"));
    reader.readAsDataURL(blob);
  });
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ParsedScene = {
  elements: unknown[];
  appState?: Record<string, unknown>;
};

export type SceneDocument = {
  type: "excalidraw";
  version: number;
  source: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
};

export function sanitizeFilename(title: string): string {
  const cleaned = title
    .trim()
    .split("")
    .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
    .join("")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();

  return cleaned.length > 0 ? cleaned : "board";
}

export function parseSceneFile(text: string): ParsedScene | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const elements = (parsed as { elements?: unknown }).elements;

  if (!Array.isArray(elements)) {
    return null;
  }

  if (
    !elements.every(
      (element) => typeof element === "object" && element !== null,
    )
  ) {
    return null;
  }

  const appState = (parsed as { appState?: unknown }).appState;

  return {
    elements,
    ...(typeof appState === "object" && appState !== null
      ? { appState: appState as Record<string, unknown> }
      : {}),
  };
}

export function buildSceneDocument(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): SceneDocument {
  return {
    type: "excalidraw",
    version: 2,
    source: "ai-whiteboard",
    elements: [...elements],
    appState,
    files,
  };
}

import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const STORAGE_KEY = "wb:scene:v0.2";

type StoredScene = {
  elements: OrderedExcalidrawElement[];
};

export function saveScene(elements: readonly OrderedExcalidrawElement[]): void {
  try {
    const scene: StoredScene = { elements: [...elements] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
  } catch (error) {
    console.warn("Failed to save the scene to localStorage", error);
  }
}

export function loadScene(): StoredScene | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as StoredScene).elements)
    ) {
      return null;
    }

    return parsed as StoredScene;
  } catch (error) {
    console.warn("Failed to load the scene from localStorage", error);
    return null;
  }
}

# v0.2: Canvas (Excalidraw embedded)

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.1.

## Goal
A full whiteboard inside `apps/web`, with no AI yet. We reuse Excalidraw as a component instead of building a drawing engine.

## Tasks
- [ ] In `apps/web`: `pnpm add @excalidraw/excalidraw`. Check the current Excalidraw docs for required peer dependencies and CSS import.
- [ ] Create `src/canvas/Canvas.tsx` rendering `<Excalidraw />` inside a wrapper `div` with an explicit height (full viewport). Without a height the canvas collapses to nothing.
- [ ] Capture the imperative API with the `excalidrawAPI` prop and expose it through a small React context + hook, `useCanvasApi()`, in `src/canvas/CanvasApiContext.tsx`. Later features read and write the scene through it:
  - read: `api.getSceneElements()`
  - write: `api.updateScene({ elements })`
- [ ] Temporary persistence so a refresh doesn't lose work: debounced (about 500ms) `onChange` that saves non-deleted elements to `localStorage`, and loads them as `initialData` on startup. This gets replaced by Supabase in v11.
- [ ] Layout shell: the canvas fills the screen; reserve an empty right-hand side area (about 360px, collapsible later) for the AI panel built in v06.
- [ ] Make sure it works under React StrictMode (no double-initialization errors).

## Acceptance criteria
- You can draw rectangles, arrows, and text; undo/redo, zoom, and export all work.
- Refreshing the page keeps the drawing.
- `useCanvasApi()` returns a non-null API after mount (show `getSceneElements().length` in a temporary debug label to prove it).
- No console errors. `pnpm typecheck` and `pnpm build` pass.

## Do NOT
- Write any custom drawing, selection, or zoom logic.
- Add AI, API calls, or auth.

## Commit message
`feat(web): embed Excalidraw canvas with api context (v0.2)`

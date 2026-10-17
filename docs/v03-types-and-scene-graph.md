# v0.3: Shared types and scene-graph (read direction)

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.2.

## Goal
Turn the heavy Excalidraw element array into the small `{ nodes, edges }` graph the AI will read. Also define the shared contracts every later version uses.

## Tasks

### `packages/shared-types`
- [ ] Write zod schemas and exported inferred types for: `Node`, `Edge`, `Graph`, `NewNode`, `NewEdge`, `Op` (use `z.discriminatedUnion('type', ...)`), `AIMode`, `AIRequest`, `AIResponse`. Use the shapes in `00-PROJECT-CONTEXT.md`.
- [ ] `NewNode`/`NewEdge` ids are strings and may be temporary ids like `new_1`; `x`, `y`, `width`, `height` are optional on `NewNode`.
- [ ] Export everything from `src/index.ts`. Add vitest tests that validate good and bad samples.

### `packages/scene-graph`
- [ ] `excalidrawToGraph(elements): Graph` with these rules:
  - Skip elements where `isDeleted` is true.
  - `rectangle`, `ellipse`, `diamond` become nodes. Their label is the bound text element (a `text` element whose `containerId` is the shape's id).
  - Standalone `text` (no `containerId`) becomes a node with `kind: 'text'`.
  - `arrow` (and `line` with bindings) becomes an Edge using `startBinding.elementId` and `endBinding.elementId`. Skip arrows missing either end (dangling arrows). An arrow's label comes from its bound text.
  - `freedraw` becomes a node with `kind: 'freedraw'`, no text, and its bounding box only. (v09 uses these.)
  - Everything else (images, frames, embeds) becomes `kind: 'other'`, or is skipped if not meaningful.
  - Round coordinates and sizes to integers. Keep original element ids as node ids.
- [ ] Do not mutate the input.
- [ ] Tests with fixtures in `packages/scene-graph/test/fixtures/`. Create at least: a 10-shape flowchart, a canvas with bound labels, one with a dangling arrow, one with a freedraw stroke. Generate real fixtures by drawing in the v0.2 app and saving the scene JSON.
- [ ] A test asserting the graph JSON is **much smaller** than the raw elements JSON (target: under 15% of the size).

### `apps/web` (temporary dev helper)
- [ ] A dev-only button "Log graph" that runs `excalidrawToGraph(api.getSceneElements())` and `console.log`s it. Hide it in production builds.

## Acceptance criteria
- `pnpm test` passes for `shared-types` and `scene-graph`.
- Drawing 3 boxes and 2 arrows, then clicking "Log graph", prints 3 nodes (with text) and 2 edges (correct `from`/`to`).
- `pnpm typecheck` passes.

## Do NOT
- Implement the reverse direction (graph/ops to elements). That is v08.
- Call any LLM.

## Commit message
`feat: shared types and excalidrawToGraph (v0.3)`

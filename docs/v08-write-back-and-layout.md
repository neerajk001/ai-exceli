# v0.8: Write back to the canvas (ops and layout)

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.7. **This is the hardest version. Take your time and test each piece alone.**

## Goal
Given a list of `Op`s, update the canvas correctly: add shapes and arrows, edit text, delete things, positioned cleanly. Test with hard-coded fake ops (no AI) first.

## Tasks

### `packages/layout`
- [ ] `placeNewNodes(graph: Graph, newNodes: NewNode[], newEdges: NewEdge[]): NewNode[]` that fills in missing `x`, `y`, `width`, `height`.
  - Size from text length (estimate roughly 9px per character, minimum 120x60, wrapped to a max width).
  - Use `dagre` (or `elkjs`) to lay out the new nodes plus their connections to existing nodes; anchor new nodes near the nodes they connect to, otherwise to the right of the current bounding box.
  - Never overlap existing nodes. Test this explicitly.
- [ ] Pure functions, with tests (overlap checks, determinism).

### `packages/scene-graph` (reverse direction)
- [ ] `applyOps(elements, ops, { layout }): { elements, idMap }`:
  - `add_node` creates shapes with bound text; temp ids (`new_1`) map to real Excalidraw ids in `idMap`.
  - `add_edge` creates arrows bound to the start/end shapes (resolve temp ids through `idMap`).
  - `update_node` changes text, kind, or geometry of an existing element.
  - `delete` removes an element **and** its bound text and any arrows connected to it.
  - Ops referencing unknown ids are skipped and reported in a `skipped` list (never throw on AI mistakes).
- [ ] Prefer Excalidraw's `convertToExcalidrawElements` (skeleton API) for creating elements, with label and arrow bindings. Check the current docs for the exact usage.
- [ ] Tests: add + edge, update, delete with connected arrows, unknown id skipped, temp id resolution.

### `apps/web`
- [ ] Dev-only panel "Apply fake ops" with a few hard-coded op lists (add a cache node between API and DB, rename a node, delete a node).
- [ ] Apply with `api.updateScene({ elements, captureUpdate: ... })` so that **one batch = one undo step**. The option name depends on the Excalidraw version (older versions used `commitToHistory`); follow the current docs.

## Acceptance criteria
- Fake `add_node` + `add_edge` ops draw a labeled box and a bound arrow, with no overlap.
- Dragging the new box moves its arrow (proves bindings work).
- Deleting a node removes its connected arrows. Renaming updates the label.
- Ctrl+Z undoes the whole batch in one step.
- All new tests pass. `pnpm typecheck` passes.

## Do NOT
- Call the LLM or add new AI modes.
- Throw on bad ops; skip and report them.

## Commit message
`feat: applyOps and layout for writing back to canvas (v0.8)`

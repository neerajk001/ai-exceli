# v0.9: Sketch cleanup

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.8.

## Goal
A messy diagram becomes a clean one. The AI decides **structure** (labels, grouping, which shapes are the same kind); our code decides **geometry** (alignment, spacing, sizes).

## Part A: tidy existing shapes (required)

- [ ] `packages/layout`: `tidy(graph): Op[]` that deterministically aligns nodes to a grid (for example 20px), equalizes sizes of same-rank nodes, and evens out spacing. Pure and tested.
- [ ] `packages/ai-core/src/modes/cleanup.ts`: the model returns `ops` limited to `update_node` (fix or normalize labels, correct `kind`, for example a decision should be a diamond) and, where clearly implied, `add_edge`. It must NOT invent new boxes in Part A. Prompt: "preserve the user's meaning; change as little as possible".
- [ ] Web: enable **Cleanup** mode. Pipeline: graph -> API -> AI ops -> `tidy` ops -> `applyOps` (one undo step).
- [ ] Tests with the mock LLM plus `tidy` unit tests.

## Part B: recognize freehand strokes (stretch, only after Part A works)

- [ ] Graph already contains `freedraw` nodes (v0.3). Export the scene as an image with Excalidraw's export utility (`exportToBlob`), downscaled (about 1024px max side), and send it as `imageBase64` in the request. Raise the API body limit deliberately and keep it bounded.
- [ ] The vision call returns ops that `delete` each recognized `freedraw` id and `add_node` the clean shape **at the same position and size** (allow explicit x/y/width/height on `add_node` for this case).
- [ ] Unknown or unrecognized strokes are left untouched.

## Acceptance criteria
- Part A: a sketch with misaligned boxes, uneven spacing, and a decision drawn as a rectangle becomes aligned, evenly spaced, with the decision as a diamond. One Ctrl+Z restores the original.
- Part A never deletes or invents shapes (assert in tests).
- Part B (if done): a hand-drawn rectangle and arrow become a clean rectangle and arrow in place.
- `pnpm test` and `pnpm typecheck` pass.

## Do NOT
- Let the AI output coordinates in Part A. Geometry comes from `tidy`.
- Send images unless Part B is being worked on.

## Commit message
`feat: sketch cleanup mode (v0.9)`

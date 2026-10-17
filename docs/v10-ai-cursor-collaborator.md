# v0.10: AI cursor and collaborator mode (MILESTONE 2)

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.9.

## Goal
You type "add a cache between the API and the DB" and watch the AI draw it live, with its own moving, labeled cursor. This is client-side only; no multi-user sync.

## Tasks
- [ ] `packages/ai-core/src/modes/collaborate.ts`: the model receives the graph and an instruction, and returns `ops` plus a short `answer` (a one-sentence narration of what it did). Rules in the prompt: small, targeted changes; reference existing ids only; use temp ids for new nodes.
- [ ] Before playing, **sanitize ops** in code: drop ops referencing unknown ids, cap the op count (for example 25).
- [ ] `apps/web/src/ai-cursor/playOps.ts`: plays ops one at a time:
  1. Move the AI cursor to the target position using Excalidraw's `collaborators` support in `updateScene` (a `Map` entry with `pointer: { x, y, tool: 'pointer' }`, a username like "AI", and a distinct color). Animate the move (about 400ms, `requestAnimationFrame` interpolation).
  2. Apply that single op (`applyOps` for one op), then pause briefly (about 250ms).
  3. After the last op, remove the AI collaborator entry.
- [ ] Undo behavior: playback should not flood undo history. Make the whole playback **one** undo step if the current Excalidraw API allows it (check the docs for `captureUpdate`); otherwise document the tradeoff in the README.
- [ ] While playing: show a **Stop** button (also Esc). Stopping cancels immediately and leaves the board in a consistent state. Prevent user edits during playback (for example by temporarily enabling view mode) so they don't conflict.
- [ ] Web: enable **Collaborate** mode in the panel; show the narration `answer` in the panel.
- [ ] Make `Cleanup` mode also use the AI cursor optionally (toggle "Watch AI work").
- [ ] Tests: `playOps` with fake timers verifies order, cancel, and cleanup of the cursor.

## Acceptance criteria
- "Add a cache between the API and the DB" shows a labeled AI cursor move to each position, drawing the cache box and rerouting/adding arrows one step at a time.
- Stop cancels cleanly; the cursor disappears; the board is valid.
- One Ctrl+Z reverts the AI's whole change (or the documented fallback).
- `pnpm test` and `pnpm typecheck` pass.

## Do NOT
- Build WebSockets, Yjs, or `apps/collab`.
- Let the AI act on ids that don't exist.

## Commit message and tag
`feat: AI cursor and collaborator mode (v0.10)` · then `git tag milestone-2`

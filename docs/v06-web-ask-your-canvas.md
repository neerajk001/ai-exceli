# v0.6: Web AI panel, Ask your canvas (MILESTONE 1)

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.5.

## Goal
The full loop works end to end in the browser: ask a question about your drawing, get an answer, and see the relevant shapes highlighted.

## Tasks
- [ ] `src/api-client/client.ts`: typed `askAI(request, { signal })` calling `POST ${VITE_API_URL}/ai`. Parse the response with the `AIResponse` zod schema; map API errors to readable messages. Add `VITE_API_URL` to `.env.example`.
- [ ] `src/ai-panel/useAI.ts`: hook managing `loading`, `error`, `result`, and cancel (AbortController).
- [ ] `src/ai-panel/AIPanel.tsx` in the reserved right-side area:
  - Mode selector with four modes. Only **Ask** is enabled; the others are disabled with a "coming soon" hint.
  - Text input + Send button (Enter to send).
  - Shows loading, error, and the answer text.
  - Render the answer as **plain text** (never `dangerouslySetInnerHTML`).
- [ ] Flow on send: `api.getSceneElements()` -> `excalidrawToGraph` -> `askAI({ mode: 'ask', graph, input })`.
- [ ] Highlight: for `highlightIds`, select those elements with `api.updateScene({ appState: { selectedElementIds: {...} } })`, then `api.scrollToContent(thoseElements, { fitToViewport: true })` so they're visible. Check the current Excalidraw docs for exact signatures.
- [ ] Guard: if the canvas has no nodes, show "Draw something first" and don't call the API.
- [ ] Remove or hide the v0.3 "Log graph" dev button.

## Acceptance criteria (manual script, run and report results)
1. Draw: Frontend -> API -> Database (3 labeled boxes, 2 arrows).
2. Ask "What happens if the database goes down?" and get a sensible answer with the API and/or Database shapes selected.
3. Ask a question with an empty canvas and get the "Draw something first" message with no network call.
4. Stop the API server, ask again, and get a readable error (not a crash).
5. Cancel an in-flight request and the UI recovers.

## Do NOT
- Implement other modes.
- Put any LLM key or provider URL in the web app.

## Commit message and tag
`feat(web): ask your canvas end to end (v0.6)` · then `git tag milestone-1`

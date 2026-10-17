# v0.7: Diagram to code

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.6.

## Goal
Turn a diagram into code. Start with one use case that matters most: **ER diagram to database schema**.

## Tasks
- [ ] `packages/ai-core/src/modes/toCode.ts`: prompt builder. `input` carries the target: `prisma` | `sql` | `mongoose` | `mermaid` | `json`.
  - Use only information present in the graph. Mark guesses as comments in the code (for example, assumed types).
  - Each node's `text` is an entity (name + fields); edges are relationships. Label text such as "1:N" or "has many" informs cardinality.
  - Return `{ code: { language, content } }` only. No prose outside the JSON.
- [ ] Register `toCode` in the `askAI` router. Extend the schema-validation tests: valid code response, missing `code` triggers the retry path.
- [ ] Web: enable the **To code** mode in the panel. Add a target dropdown. Show the result in a `CodePanel` with a copy button and a download button (filename by language). Display as text only; never execute it.
- [ ] A hand-drawn example for testing: `users`, `posts`, `comments` boxes with fields in each box and arrows labeled with relations. Save as a fixture and a demo `.excalidraw` file in `apps/web/public/examples/`.

## Acceptance criteria
- The example ER sketch + target `prisma` returns a schema with all three models and correct relations, which passes `npx prisma validate` (run it on a temp copy and report the result).
- Switching target to `sql` and `mermaid` works.
- Unit tests for the mode pass with the mock LLM. `pnpm typecheck` passes.

## Do NOT
- Add wireframe-to-React yet.
- Run, eval, or render generated code in the app.

## Commit message
`feat: diagram to code mode with ER targets (v0.7)`

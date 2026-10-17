# AI Whiteboard: Project Context

> Read this file first, every time, before the version file you were given.

## What we are building

A whiteboard built on Excalidraw, with AI that works **on the canvas itself** (not in a chat box beside it).

Four AI features:

1. **Sketch cleanup**: rough sketch becomes clean, aligned, labeled shapes.
2. **Diagram to code**: ER diagram becomes Prisma/SQL schema, wireframe becomes React, etc.
3. **Ask your canvas**: questions about the board; relevant shapes get highlighted.
4. **AI collaborator cursor**: the AI draws on the board live, with its own moving cursor.

## Core idea (everything follows from this)

The canvas is just JSON. Every AI feature is the same loop:

```
canvas JSON -> simple graph -> LLM -> validated result (ops / answer / code) -> apply to canvas
```

We never send raw Excalidraw elements to the LLM (huge and noisy). We send a small `{ nodes, edges }` graph.
The AI decides **structure**. Our code decides **layout and geometry**.

## Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict) everywhere |
| Web | React + Vite + `@excalidraw/excalidraw` (MIT) |
| API | Node + Express + zod |
| Database | Supabase (Postgres + Auth), queried with **Prisma** (introduced in v11) |
| LLM | Provider-agnostic wrapper in `ai-core`; API key lives on the server only |
| Tests | vitest (+ supertest for API) |
| Package scope | `@wb/*` |

## Folder structure

```
ai-whiteboard/
├── apps/
│   ├── web/                    # React + Vite + Excalidraw
│   │   └── src/
│   │       ├── canvas/         # Excalidraw wrapper + api context
│   │       ├── ai-panel/       # mode picker, input, answer/code views
│   │       ├── ai-cursor/      # plays AI ops one by one
│   │       ├── api-client/     # typed calls to apps/api
│   │       └── auth/           # Supabase auth (v11)
│   └── api/                    # Node + Express
│       ├── prisma/             # schema.prisma + migrations (v11)
│       └── src/
│           ├── routes/         # ai.ts, boards.ts (v11), health.ts
│           ├── middleware/     # auth, rate limit, error handler
│           ├── env.ts          # zod-validated environment
│           ├── app.ts          # createApp() (testable)
│           └── server.ts       # listen()
├── packages/
│   ├── shared-types/           # zod schemas: Node, Edge, Graph, Op, AIRequest, AIResponse
│   ├── scene-graph/            # Excalidraw elements <-> Graph / Ops
│   ├── ai-core/                # prompts, LLM wrapper, mode router
│   │   └── src/modes/          # ask.ts toCode.ts cleanup.ts collaborate.ts
│   └── layout/                 # dagre/elkjs placement + tidy
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Dependency rules (never break these)

- `packages/*` never import from `apps/*`.
- `shared-types` imports nothing except `zod`.
- `ai-core` and `layout` are pure (JSON in, JSON out). No React, Express, or Excalidraw imports.
- Only `apps/web` and `scene-graph` know Excalidraw's element format.
- Only `apps/api` talks to the database and the LLM provider.
- The LLM API key never reaches the browser.

## Key contracts (defined in `@wb/shared-types` in v03, referenced by every later version)

```ts
Node       = { id, kind: 'rectangle'|'ellipse'|'diamond'|'text'|'freedraw'|'other',
               text?: string, x, y, width, height }
Edge       = { id, from, to, label?: string }
Graph      = { nodes: Node[], edges: Edge[] }

Op         = { type: 'add_node',    node: NewNode }          // x/y/width/height optional (layout fills them)
           | { type: 'add_edge',    edge: NewEdge }          // may reference temp ids like "new_1"
           | { type: 'update_node', id, patch: Partial<Node> }
           | { type: 'delete',      id }

AIMode     = 'ask' | 'toCode' | 'cleanup' | 'collaborate'
AIRequest  = { mode: AIMode, graph: Graph, input?: string, imageBase64?: string }
AIResponse = { ops?: Op[], highlightIds?: string[], answer?: string,
               code?: { language: string, content: string } }
```

Each mode fills a different part of `AIResponse`:
`ask` -> `answer` + `highlightIds` · `toCode` -> `code` · `cleanup` and `collaborate` -> `ops` (+ optional `answer`).

## Agent execution protocol

1. Read this file, then **only** the version file you were given. Do not build ahead.
2. Follow the tasks in order. Keep code small and focused; no speculative abstractions.
3. Verify every acceptance criterion by actually running it. In your final message, list the commands you ran and their results.
4. If a library's current docs disagree with this plan (APIs change: Excalidraw, Prisma, Supabase), follow the current docs and tell the user what you changed and why.
5. Do not add dependencies that aren't listed without saying why.
6. Never commit `.env` files or secrets. Keep `.env.example` updated.
7. When unsure about auth, database schema, or API contracts, **ask** instead of guessing.
8. End with the commit message given in the version file, then stop and wait.

## Version index

| File | Version | What works when it's done |
|---|---|---|
| `v01-monorepo-shell.md` | v0.1 | Monorepo runs; web and api start |
| `v02-canvas.md` | v0.2 | Full whiteboard in your own app |
| `v03-types-and-scene-graph.md` | v0.3 | Canvas becomes a small graph |
| `v04-ai-core-ask.md` | v0.4 | Ask mode works from a script |
| `v05-api-ai-route.md` | v0.5 | `POST /ai` works via curl |
| `v06-web-ask-your-canvas.md` | v0.6 | **Milestone 1**: ask the canvas, shapes highlight |
| `v07-diagram-to-code.md` | v0.7 | ER sketch becomes a schema |
| `v08-write-back-and-layout.md` | v0.8 | Ops can draw on the canvas |
| `v09-sketch-cleanup.md` | v0.9 | Messy sketch becomes clean |
| `v10-ai-cursor-collaborator.md` | v0.10 | **Milestone 2**: AI draws live |
| `v11-supabase-prisma-auth-boards.md` | v0.11 | Login, save/load boards |
| `v12-production.md` | **v1.0** | Hardened, tested, deployed |

Out of scope until after v1.0: multi-user real-time sync (`apps/collab`, Yjs), wireframe-to-React, voice input, auto-generated walkthroughs.

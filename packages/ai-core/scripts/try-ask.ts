import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { excalidrawToGraph } from "@wb/scene-graph";

import { askAI } from "../src/askAI";
import { createLLMClient } from "../src/llm";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(): string | undefined {
  const candidates = [resolve(here, "../../../.env"), resolve(here, "../.env")];
  const found = candidates.find((candidate) => existsSync(candidate));

  if (found) {
    process.loadEnvFile(found);
  }

  return found;
}

const envFile = loadEnvFile();

const fixturePath = resolve(
  here,
  "../../scene-graph/test/fixtures/frontend-api-db.json",
);
const elements = JSON.parse(readFileSync(fixturePath, "utf8")) as Parameters<
  typeof excalidrawToGraph
>[0];
const graph = excalidrawToGraph(elements);

const question =
  process.argv.slice(2).join(" ").trim() || "what connects to the database?";

console.log(envFile ? `env: ${envFile}` : "env: none found, using process.env");
console.log(
  "nodes:",
  graph.nodes.map((node) => `${node.id}="${node.text}"`).join(", "),
);
console.log(
  "edges:",
  graph.edges.map((edge) => `${edge.from}->${edge.to}`).join(", "),
);
console.log(`question: ${question}\n`);

const llm = createLLMClient();
const response = await askAI(llm, { mode: "ask", graph, input: question });

const labelById = new Map(
  graph.nodes.map((node) => [node.id, node.text ?? node.id]),
);

console.log("answer:", response.answer);
console.log(
  "highlightIds:",
  (response.highlightIds ?? [])
    .map((id) => `${id} (${labelById.get(id) ?? "unknown"})`)
    .join(", ") || "(none)",
);

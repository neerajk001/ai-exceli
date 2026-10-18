import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { excalidrawToGraph } from "@wb/scene-graph";

import { askAI } from "../src/askAI";
import { createLLMClient } from "../src/llm";
import { isCodeTarget } from "../src/modes/toCode";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(): string | undefined {
  const candidates = [resolve(here, "../../../.env"), resolve(here, "../.env")];
  const found = candidates.find((candidate) => existsSync(candidate));

  if (found) {
    process.loadEnvFile(found);
  }

  return found;
}

const args = process.argv.slice(2);
const target = args[0] ?? "prisma";
const outIndex = args.indexOf("--out");
const outPath = outIndex === -1 ? undefined : args[outIndex + 1];

if (!isCodeTarget(target)) {
  console.error(
    `Unknown target "${target}". Use one of: prisma, sql, mongoose, mermaid, json`,
  );
  process.exit(1);
}

const envFile = loadEnvFile();

const fixturePath = resolve(
  here,
  "../../scene-graph/test/fixtures/users-posts-comments.json",
);
const elements = JSON.parse(readFileSync(fixturePath, "utf8")) as Parameters<
  typeof excalidrawToGraph
>[0];
const graph = excalidrawToGraph(elements);

console.log(envFile ? `env: ${envFile}` : "env: none found, using process.env");
console.log(
  "entities:",
  graph.nodes.map((node) => JSON.stringify(node.text)).join(", "),
);
console.log(
  "relations:",
  graph.edges
    .map((edge) => `${edge.from}->${edge.to} (${edge.label ?? "?"})`)
    .join(", "),
);
console.log(`target: ${target}\n`);

const llm = createLLMClient();
const response = await askAI(llm, { mode: "toCode", graph, input: target });

const code = response.code;

if (!code) {
  console.error("No code in the response");
  process.exit(1);
}

console.log(`language: ${code.language}\n`);
console.log(code.content);

if (outPath) {
  writeFileSync(outPath, code.content);
  console.log(`\nwritten to ${outPath}`);
}

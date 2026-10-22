import {
  AskIcon,
  CleanupIcon,
  CodeIcon,
  CollaborateIcon,
  GenerateIcon,
} from "./icons";

export const AI_MODES = [
  {
    id: "ask",
    label: "Ask",
    title: "Ask about your diagram",
    description: "Get answers and highlight the shapes that matter.",
    placeholder: "Ask about your canvas...",
    examples: [
      "What connects to the database?",
      "Explain this flow simply",
      "Where could this fail?",
    ],
    icon: AskIcon,
  },
  {
    id: "toCode",
    label: "To code",
    title: "Generate code",
    description: "Turn your diagram into a structured implementation.",
    placeholder: "Choose a target and generate code.",
    examples: [],
    icon: CodeIcon,
  },
  {
    id: "generate",
    label: "Generate",
    title: "Generate a diagram",
    description: "Describe an idea and let AI draw the first draft.",
    placeholder: 'e.g. "draw an order service with a queue and a database"',
    examples: [
      "A checkout flow with payments and email",
      "A microservices architecture for chat",
      "A user onboarding journey",
    ],
    icon: GenerateIcon,
  },
  {
    id: "cleanup",
    label: "Clean up",
    title: "Clean up your canvas",
    description: "Tidy alignment and improve readability in one pass.",
    placeholder: "Clean up the current canvas.",
    examples: [],
    icon: CleanupIcon,
  },
  {
    id: "collaborate",
    label: "Collaborate",
    title: "Build together with AI",
    description: "Ask AI to add to or reshape the current diagram.",
    placeholder: 'e.g. "add a cache between the API and the database"',
    examples: [
      "Add a cache before the database",
      "Split the API into two services",
      "Add an error branch",
    ],
    icon: CollaborateIcon,
  },
] as const;

export type AIMode = (typeof AI_MODES)[number]["id"];

export const MODE_BY_ID = Object.fromEntries(
  AI_MODES.map((mode) => [mode.id, mode]),
) as Record<AIMode, (typeof AI_MODES)[number]>;

export const SEND_LABELS: Record<AIMode, string> = {
  ask: "Ask AI",
  toCode: "Generate code",
  cleanup: "Clean up diagram",
  collaborate: "Add to canvas",
  generate: "Generate diagram",
};

export function defaultOutputTab(mode: AIMode) {
  if (mode === "toCode") {
    return "code" as const;
  }

  if (mode === "cleanup") {
    return "next" as const;
  }

  return "explanation" as const;
}

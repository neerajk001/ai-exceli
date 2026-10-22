/**
 * The only file allowed to know about LLM providers.
 * Everything else talks to the `LLMClient` interface.
 */

export type LLMGenerateParams = {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  imageBase64?: string;
  strict?: boolean;
};

export interface LLMClient {
  generate(params: LLMGenerateParams): Promise<unknown>;
}

export type LLMEnvironment = {
  LLM_PROVIDER?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
};

const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4o-mini";

export function createLLMClient(env: LLMEnvironment = process.env): LLMClient {
  const provider = env.LLM_PROVIDER ?? DEFAULT_PROVIDER;
  const apiKey = env.LLM_API_KEY;
  const model = env.LLM_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not set. Put it in a local .env file and never commit it.",
    );
  }

  switch (provider) {
    case "openai":
      return createOpenAIClient({ apiKey, model });
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${provider}" (supported: openai)`,
      );
  }
}

type OpenAIClientOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

function createOpenAIClient(options: OpenAIClientOptions): LLMClient {
  const url = `${options.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`;

  return {
    async generate({ system, user, jsonSchema, imageBase64, strict }) {
      const userContent = imageBase64
        ? [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: toDataUrl(imageBase64) } },
          ]
        : user;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "result",
              strict: strict ?? true,
              schema: withoutMetaKeys(jsonSchema),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `LLM request failed (${response.status}): ${await response.text()}`,
        );
      }

      const content = extractMessageContent(await response.json());

      return parseJsonOrRaw(content);
    },
  };
}

function withoutMetaKeys(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const { $schema: _schema, ...rest } = schema;
  return rest;
}

function toDataUrl(imageBase64: string): string {
  return imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;
}

function extractMessageContent(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    throw new Error("LLM response was not an object");
  }

  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("LLM response contained no choices");
  }

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    throw new Error("LLM response contained no message");
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") {
    throw new Error("LLM response message contained no text content");
  }

  return content;
}

function parseJsonOrRaw(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

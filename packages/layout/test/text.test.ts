import { describe, expect, it } from "vitest";

import {
  EDGE_FONT_SIZE,
  MAX_EDGE_LABEL_WIDTH,
  NODE_FONT_SIZE,
  TEXT_WIDTH_RATIO,
  wrapEdgeText,
  wrapNodeText,
} from "../src/text";

describe("text wrapping", () => {
  it("wraps long labels without exceeding the available width", () => {
    const wrapped = wrapNodeText(
      "Validate every incoming request and reject malformed payloads",
      180,
    );

    expect(wrapped.lines.length).toBeGreaterThan(1);
    expect(wrapped.text).toContain("\n");
    expect(wrapped.width).toBeLessThanOrEqual(180);

    for (const line of wrapped.lines) {
      expect(line.length * NODE_FONT_SIZE * TEXT_WIDTH_RATIO).toBeLessThanOrEqual(
        180,
      );
    }
  });

  it("preserves explicit line breaks", () => {
    const wrapped = wrapNodeText("First line\nSecond line", 240);

    expect(wrapped.lines.slice(0, 2)).toEqual(["First line", "Second line"]);
  });

  it("hard-wraps an unbreakable word", () => {
    const wrapped = wrapEdgeText("a".repeat(80));

    expect(wrapped.lines.length).toBeGreaterThan(1);
    expect(
      wrapped.lines.every(
        (line) =>
          line.length * EDGE_FONT_SIZE * TEXT_WIDTH_RATIO <=
          MAX_EDGE_LABEL_WIDTH + 0.01,
      ),
    ).toBe(true);
  });
});

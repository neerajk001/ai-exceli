export const NODE_FONT_SIZE = 20;
export const EDGE_FONT_SIZE = 14;
export const TEXT_WIDTH_RATIO = 0.55;
export const NODE_LINE_HEIGHT_RATIO = 1.25;
export const EDGE_LINE_HEIGHT_RATIO = 1.3;
export const NODE_TEXT_PADDING = 20;
export const MAX_EDGE_LABEL_WIDTH = 240;

export type WrappedText = {
  lines: string[];
  text: string;
  width: number;
  height: number;
};

/**
 * Approximate text wrapping. Excalidraw's canvas metrics are not available in
 * the layout layer, so we use a conservative character width and wrap on word
 * boundaries. The resulting text is stored with explicit newlines so the
 * rendered text cannot overflow the node or edge label.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  lineHeightRatio: number,
): WrappedText {
  const charWidth = fontSize * TEXT_WIDTH_RATIO;
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  const sourceLines = text.length === 0 ? [""] : text.split("\n");
  const lines: string[] = [];

  for (const sourceLine of sourceLines) {
    lines.push(...wrapLine(sourceLine, maxChars));
  }

  const longest = Math.max(...lines.map((line) => line.length), 1);

  return {
    lines,
    text: lines.join("\n"),
    width: Math.max(fontSize, longest * charWidth),
    height: Math.max(fontSize * lineHeightRatio, lines.length * fontSize * lineHeightRatio),
  };
}

function wrapLine(line: string, maxChars: number): string[] {
  const trimmed = line.trim();

  if (trimmed.length <= maxChars) {
    return [line];
  }

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
    }

    if (word.length <= maxChars) {
      current = word;
      continue;
    }

    let remainder = word;

    while (remainder.length > maxChars) {
      lines.push(remainder.slice(0, maxChars));
      remainder = remainder.slice(maxChars);
    }

    current = remainder;
  }

  if (current.length > 0 || lines.length === 0) {
    lines.push(current);
  }

  return lines;
}

export function wrapNodeText(text: string, boxWidth: number): WrappedText {
  const available = Math.max(40, boxWidth - NODE_TEXT_PADDING);

  return wrapText(text, available, NODE_FONT_SIZE, NODE_LINE_HEIGHT_RATIO);
}

export function wrapEdgeText(text: string): WrappedText {
  return wrapText(
    text,
    MAX_EDGE_LABEL_WIDTH,
    EDGE_FONT_SIZE,
    EDGE_LINE_HEIGHT_RATIO,
  );
}

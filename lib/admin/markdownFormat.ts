export type Mark = "bold" | "italic" | "underline" | "strike";

export type Edit = { value: string; start: number; end: number };

// ---------- Delimiters ----------

const DELIMS: Record<Mark, string> = {
  bold: "**",
  italic: "*",
  underline: "++",
  strike: "~~",
};

function isPresent(mark: Mark, count: number) {
  return mark === "italic" ? count % 2 === 1 : count >= 2;
}

function leading(text: string, ch: string) {
  let n = 0;
  while (text[n] === ch) n++;
  return n;
}

function trailing(text: string, ch: string) {
  let n = 0;
  while (text[text.length - 1 - n] === ch) n++;
  return n;
}

function countBefore(value: string, index: number, ch: string) {
  let n = 0;
  while (index - 1 - n >= 0 && value[index - 1 - n] === ch) n++;
  return n;
}

function countAfter(value: string, index: number, ch: string) {
  let n = 0;
  while (value[index + n] === ch) n++;
  return n;
}

// ---------- Toggle a mark around a selection ----------

export function toggleMark(
  value: string,
  start: number,
  end: number,
  mark: Mark,
): Edit {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(value[s])) s++;
  while (e > s && /\s/.test(value[e - 1])) e--;
  if (s === e) return { value, start, end };

  const delim = DELIMS[mark];
  const ch = delim[0];
  const n = delim.length;
  const text = value.slice(s, e);

  const inside = Math.min(leading(text, ch), trailing(text, ch));
  if (inside > 0 && isPresent(mark, inside) && text.length > 2 * n) {
    const inner = text.slice(n, text.length - n);
    return {
      value: value.slice(0, s) + inner + value.slice(e),
      start: s,
      end: s + inner.length,
    };
  }

  const outside = Math.min(countBefore(value, s, ch), countAfter(value, e, ch));
  if (isPresent(mark, outside)) {
    return {
      value: value.slice(0, s - n) + text + value.slice(e + n),
      start: s - n,
      end: e - n,
    };
  }

  return {
    value: value.slice(0, s) + delim + text + delim + value.slice(e),
    start: s + n,
    end: e + n,
  };
}

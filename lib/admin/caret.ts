export type Anchor = { top: number; left: number; width: number };

// ---------- Mirror technique to locate a selection inside a textarea ----------

const MIRRORED = [
  "direction",
  "box-sizing",
  "width",
  "overflow-x",
  "overflow-y",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-style",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-style",
  "font-variant",
  "font-weight",
  "font-stretch",
  "font-size",
  "line-height",
  "font-family",
  "text-align",
  "text-transform",
  "text-indent",
  "letter-spacing",
  "word-spacing",
  "tab-size",
];

export function getSelectionAnchor(el: HTMLTextAreaElement): Anchor | null {
  const { selectionStart: start, selectionEnd: end, value } = el;
  const computed = window.getComputedStyle(el);

  const mirror = document.createElement("div");
  for (const prop of MIRRORED) {
    mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  }
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    overflow: "hidden",
  });

  const marker = document.createElement("span");
  marker.textContent = value.slice(start, end);
  mirror.append(
    document.createTextNode(value.slice(0, start)),
    marker,
    document.createTextNode(value.slice(end)),
  );
  document.body.appendChild(mirror);

  try {
    const rect = marker.getClientRects()[0];
    if (!rect) return null;

    const origin = mirror.getBoundingClientRect();
    const top = rect.top - origin.top - el.scrollTop;
    const left = rect.left - origin.left - el.scrollLeft + rect.width / 2;

    if (top < -4 || top > el.clientHeight) return null;
    return { top, left, width: el.clientWidth };
  } finally {
    document.body.removeChild(mirror);
  }
}

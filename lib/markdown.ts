import { Marked, type TokenizerAndRendererExtension } from "marked";

// ---------- Allowed output ----------

export const MARKDOWN_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "a",
  "img",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h3",
  "h4",
  "hr",
  "code",
  "pre",
];

// ---------- ++underline++ extension ----------

const underline: TokenizerAndRendererExtension = {
  name: "underline",
  level: "inline",
  start(src) {
    return src.indexOf("++");
  },
  tokenizer(src) {
    const match = /^\+\+(?=\S)([\s\S]*?\S)\+\+/.exec(src);
    if (!match) return undefined;
    return {
      type: "underline",
      raw: match[0],
      text: match[1],
      tokens: this.lexer.inlineTokens(match[1]),
    };
  },
  renderer(token) {
    return `<u>${this.parser.parseInline(token.tokens ?? [])}</u>`;
  },
};

const marked = new Marked({
  gfm: true,
  breaks: true,
  extensions: [underline],
});

// ---------- Parser (output is NOT sanitized) ----------

export function parseMarkdown(source: string): string {
  return marked.parse(source, { async: false });
}

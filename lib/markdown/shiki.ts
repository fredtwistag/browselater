import { createHighlighter, type Highlighter } from "shiki";

const THEMES = { light: "github-light", dark: "github-dark" } as const;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEMES.light, THEMES.dark],
      langs: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "bash",
        "sh",
        "md",
        "html",
        "css",
        "python",
        "go",
        "sql",
        "yaml",
        "diff",
        "rust",
      ],
    });
  }
  return highlighterPromise;
}

/**
 * Render `code` as HTML with dual light/dark themes baked in.
 * The output uses CSS variables so theme switching works without re-rendering.
 */
export async function highlightCode(code: string, lang: string | undefined): Promise<string> {
  const highlighter = await getHighlighter();
  const supported = highlighter.getLoadedLanguages().includes(lang as never);
  const language = supported ? (lang as string) : "txt";
  try {
    return highlighter.codeToHtml(code, {
      lang: language,
      themes: { light: THEMES.light, dark: THEMES.dark },
      defaultColor: false,
    });
  } catch {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strip a site-name suffix from an extracted page title.
 *
 * Examples:
 *   "Some headline | The New York Times"           + site="The New York Times" → "Some headline"
 *   "How we shipped X - Stripe Engineering"        + site="Stripe Engineering" → "How we shipped X"
 *   "Article — Vercel Blog"                         + site=null                 → "Article — Vercel Blog" (no-op)
 *
 * Conservative: when we don't know the site name from og:site_name, we leave
 * the title alone rather than risk over-trimming legitimate em-dashed titles.
 */
export function cleanTitle(
  rawTitle: string | null | undefined,
  siteName: string | null,
): string | null {
  if (!rawTitle) return null;
  const title = rawTitle.trim();
  if (!title) return null;
  if (!siteName) return title;

  const site = siteName.trim();
  if (!site) return title;

  // Match the site name at the end after one of the common separators.
  // We allow optional whitespace and a few separator variants.
  const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\s*[\\|\\-–—:·]\\s*${escaped}\\s*$`, "i");
  const stripped = title.replace(re, "").trim();

  // Sanity guard: don't return an empty / near-empty string.
  if (stripped.length < 3) return title;
  return stripped;
}

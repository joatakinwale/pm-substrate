/**
 * Pure HTML helpers — template rendering, tracking-pixel injection,
 * link rewriting for click tracking.
 *
 * Kept in a separate module from the Resend dispatch in index.ts so the
 * rendering pieces can be unit-tested without spinning up the queue
 * runtime. Mirrors the Python helpers in
 * backend/app/services/email_sender.py — if a render difference shows
 * up between backend-rendered and Worker-rendered output, the suite in
 * email_helpers.test.ts is where the divergence should be caught first.
 */

/**
 * Render template variables like {{first_name}} into HTML.
 *
 * Supports both {{variable}} and {{ variable }} syntax (whitespace
 * inside the braces is tolerated). Unknown variables are left as-is so
 * a typo in a template doesn't ship an empty space — it ships a visible
 * placeholder we can grep for.
 */
export function renderTemplate(
  html: string,
  variables: Record<string, string>
): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    // `noUncheckedIndexedAccess` makes variables[key] string|undefined; the
    // hasOwnProperty guard means the lookup will succeed, but TS can't prove
    // it, so coerce. `?? match` preserves the original placeholder if the
    // value is somehow nullish (e.g. a deliberate `undefined` injected).
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? (variables[key] ?? match)
      : match;
  });
}

/**
 * Inject an invisible 1x1 tracking pixel before </body> for open tracking.
 *
 * If the body has no </body> tag (some inlined campaign HTML doesn't),
 * we append the pixel at the end. The match is case-insensitive — the
 * Python original used a lower() check on the haystack which is
 * effectively the same thing. We keep the original casing of </body>
 * in the output to avoid noisy diffs in customer-facing HTML.
 */
export function addTrackingPixel(
  html: string,
  sendId: string,
  baseUrl: string
): string {
  const pixel =
    `<img src="${baseUrl}/api/tracking/open/${sendId}" ` +
    `width="1" height="1" style="display:none" alt="" />`;

  // Case-insensitive replace of the first </body>. /i is enough; we don't
  // need /g because the trailing </body> is the canonical insertion point.
  const bodyClose = /<\/body>/i;
  if (bodyClose.test(html)) {
    return html.replace(bodyClose, (match) => `${pixel}${match}`);
  }
  return html + pixel;
}

/**
 * Rewrite <a href="..."> links to go through the click tracker.
 *
 * Skips: mailto:, tel:, and in-page anchors (#fragment) — those don't
 * correspond to a click we'd want to count, and rewriting mailto: would
 * actively break the link.
 *
 * URL encoding mirrors Python's ``urllib.parse.quote(url, safe="")``:
 * every reserved char is percent-encoded, including ``/`` and ``:``.
 * encodeURIComponent already does this for the characters Python's
 * ``quote(safe="")`` encodes; the only practical difference is that
 * Python's quote leaves ``_.-~`` unencoded (so does encodeURIComponent),
 * so the two outputs match for any URL we'd realistically see in
 * customer email content.
 */
export function rewriteLinks(
  html: string,
  sendId: string,
  baseUrl: string
): string {
  return html.replace(/href="([^"]+)"/g, (match, originalUrl: string) => {
    if (
      originalUrl.startsWith("mailto:") ||
      originalUrl.startsWith("tel:") ||
      originalUrl.startsWith("#")
    ) {
      return match;
    }
    const encoded = encodeURIComponent(originalUrl);
    return `href="${baseUrl}/api/tracking/click/${sendId}?url=${encoded}"`;
  });
}

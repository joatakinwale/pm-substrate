export function normalizeAbsoluteUrl(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }
  if (withoutTrailingSlash.startsWith("//")) {
    return `https:${withoutTrailingSlash}`;
  }
  return `https://${withoutTrailingSlash}`;
}

export function stripSlashes(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^\/+|\/+$/g, "");
}

export function joinUrlPath(
  base: string | null | undefined,
  ...segments: Array<string | null | undefined>
): string {
  const normalizedBase = normalizeAbsoluteUrl(base);
  const cleanSegments = segments.map(stripSlashes).filter(Boolean);
  if (!normalizedBase) return cleanSegments.join("/");
  return [normalizedBase, ...cleanSegments].join("/");
}

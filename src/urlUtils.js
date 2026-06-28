/**
 * Internal URL-building helpers.
 *
 * Caller-supplied identifiers (collection/document ids, file/bucket ids,
 * filenames) are percent-encoded before being placed into a request path, and
 * obvious path-traversal segments are rejected — so a value like `'../other'`
 * or one containing `?`/`#`/`/` can't escape the intended endpoint or inject
 * query parameters. The server still enforces its own authorization.
 */

/** Percent-encode a single path segment, rejecting traversal segments. */
export function encodePathSegment(segment) {
  if (segment === "." || segment === "..") {
    throw new Error(`Invalid path segment: "${segment}"`);
  }
  return encodeURIComponent(segment);
}

/**
 * Encode a multi-segment path such as `"collection/docId"`, preserving the `/`
 * separators while encoding each segment and dropping empty segments.
 */
export function encodePath(path) {
  return String(path)
    .split("/")
    .filter((s) => s.length > 0)
    .map(encodePathSegment)
    .join("/");
}

/** Build an encoded query string (with leading `?`) or "" when empty. */
export function buildQueryString(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) usp.append(key, String(value));
  }
  const q = usp.toString();
  return q ? `?${q}` : "";
}

/**
 * Validate a base URL: must be http(s); plaintext http is only allowed for
 * loopback hosts (otherwise the projectToken/JWT would travel in cleartext).
 * Returns the normalized URL string.
 */
export function validateBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.length === 0) {
    throw new Error("baseUrl is required");
  }
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("baseUrl must be a valid http:// or https:// URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("baseUrl must be an http:// or https:// URL");
  }
  const host = url.hostname;
  const isLoopback =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1";
  if (url.protocol === "http:" && !isLoopback) {
    throw new Error(
      "baseUrl must use https:// (plaintext http:// is only allowed for localhost)"
    );
  }
  return baseUrl;
}

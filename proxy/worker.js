/*
 * ERETHEUM Web Viewer Worker
 * Cloudflare Workers / Wrangler entrypoint.
 *
 * Request:
 *   /?url=https%3A%2F%2Fexample.com
 */

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const PRIVATE_HOSTS = /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|::1|\[::1\])$/i;

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return PRIVATE_HOSTS.test(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal");
}

function validateTarget(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  if (url.username || url.password) return null;
  if (!["", "80", "443"].includes(url.port)) return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

function proxiedUrl(url) {
  return "/?url=" + encodeURIComponent(url.href);
}

function rewriteHtml(html, baseUrl) {
  const absolute = (value) => {
    if (!value || value.startsWith("#") ||
        /^(data:|javascript:|mailto:|tel:|blob:|about:)/i.test(value)) return value;
    try { return new URL(value, baseUrl).href; } catch { return value; }
  };

  const attrs = ["href", "src", "action", "poster", "formaction"];
  for (const attr of attrs) {
    const re = new RegExp("(" + attr + "\\s*=\\s*[\\\"'])([^\\\"']+)([\\\"'])", "gi");
    html = html.replace(re, (_, prefix, value, quote) => {
      const absoluteUrl = absolute(value);
      return prefix + (absoluteUrl === value ? value : proxiedUrl(new URL(absoluteUrl))) + quote;
    });
  }

  html = html.replace(/<head(\s[^>]*)?>/i, match =>
    match + '<meta name="referrer" content="no-referrer">'
  );
  return html;
}

function error(message, status = 400) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

async function fetchUpstream(initialUrl) {
  let target = initialUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const response = await fetch(target.href, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "ERETHEUM-Web-Viewer/1.0",
        "Accept": "text/html,application/xhtml+xml,application/json,text/plain,*/*"
      }
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, target };
    }

    const location = response.headers.get("location");
    if (!location) return { response, target };

    const next = validateTarget(new URL(location, target).href);
    if (!next) return { error: "Redirect target is not allowed." };
    target = next;
  }

  return { error: "Too many redirects." };
}

async function proxy(request) {
  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get("url");

  if (!raw) return error("Missing url parameter.");
  const target = validateTarget(raw);
  if (!target) return error("Only public HTTP(S) URLs on ports 80/443 are supported.", 403);

  try {
    const result = await fetchUpstream(target);
    if (result.error) return error(result.error, 502);

    const upstream = result.response;
    if (!upstream.ok) return error("Upstream returned " + upstream.status + ".", 502);

    const type = upstream.headers.get("content-type") || "application/octet-stream";
    const len = Number(upstream.headers.get("content-length") || 0);
    if (Number.isFinite(len) && len > MAX_BYTES) {
      return error("Response is too large for the viewer.", 413);
    }

    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": type,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff"
        }
      });
    }

    const body = await upstream.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES) {
      return error("Page is too large for the viewer.", 413);
    }

    return new Response(rewriteHtml(body, result.target.href), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer"
      }
    });
  } catch {
    return error("The upstream site could not be reached.", 502);
  }
}

export default {
  async fetch(request) {
    if (request.method !== "GET") return error("GET only.", 405);
    return proxy(request);
  }
};

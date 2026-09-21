/*
 * ERETHEUM Web Viewer Worker
 * Deploy this file as a Cloudflare Worker (or adapt the handler to another
 * serverless runtime). It intentionally only proxies public HTTP(S) pages.
 *
 * Frontend URL:
 *   https://YOUR-WORKER.example.workers.dev/?url=https%3A%2F%2Fexample.com
 */

const MAX_BYTES = 6 * 1024 * 1024;
const PRIVATE_HOSTS = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/i;

function blockedHost(hostname) {
  return PRIVATE_HOSTS.test(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local");
}

function rewriteHtml(html, baseUrl) {
  const absolute = (value) => {
    if (!value || value.startsWith("#") || /^(data:|javascript:|mailto:|tel:|blob:)/i.test(value)) return value;
    try { return new URL(value, baseUrl).href; } catch { return value; }
  };
  const attrs = ["href","src","action","poster","formaction"];
  for (const attr of attrs) {
    const re = new RegExp("(" + attr + "\\s*=\\s*["'])([^"']+)(["'])", "gi");
    html = html.replace(re, (_, a, value, c) => a + "/?url=" + encodeURIComponent(absolute(value)) + c);
  }
  html = html.replace(/<head(\s[^>]*)?>/i, m => m + '<meta name="referrer" content="no-referrer">');
  return html;
}

async function proxy(request) {
  const requestUrl = new URL(request.url);
  let target = requestUrl.searchParams.get("url") || "https://www.google.com/";
  try { target = new URL(target); } catch { return new Response("Invalid URL", {status:400}); }
  if (!["http:","https:"].includes(target.protocol)) return new Response("Only HTTP(S) URLs are supported.", {status:400});
  if (blockedHost(target.hostname)) return new Response("That host is not available through this viewer.", {status:403});

  const upstream = await fetch(target.href, {
    method:"GET",
    redirect:"follow",
    headers:{"User-Agent":"ERETHEUM-Web-Viewer/1.0","Accept":"text/html,application/xhtml+xml,application/json,text/plain,*/*"}
  });
  if (!upstream.ok) return new Response("Upstream returned " + upstream.status, {status:502});
  const type = upstream.headers.get("content-type") || "application/octet-stream";
  const len = Number(upstream.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return new Response("Response is too large for the viewer.", {status:413});

  if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
    return new Response(upstream.body, {
      status:upstream.status,
      headers:{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff"}
    });
  }

  const body = await upstream.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BYTES) return new Response("Page is too large for the viewer.", {status:413});
  const rewritten = rewriteHtml(body, target.href);
  return new Response(rewritten, {
    status:200,
    headers:{
      "content-type":"text/html; charset=UTF-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
      "referrer-policy":"no-referrer"
    }
  });
}

export default { async fetch(request) {
  if (request.method !== "GET") return new Response("GET only.", {status:405});
  return proxy(request);
}};

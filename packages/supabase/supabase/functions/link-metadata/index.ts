import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Resolves a URL → page title + favicon for the trace links feature.
 * Authenticated; the function gateway already validates the JWT.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512_000; // ~500 KB is plenty for <head>.

const USER_AGENT =
  "Mozilla/5.0 (compatible; CuroliaLinkPreview/1.0; +https://curolia.app)";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}

type ParsedHead = {
  title: string | null;
  iconHref: string | null;
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    );
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s/>]+))`,
    "i",
  );
  const m = tag.match(re);
  if (!m) return null;
  return decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
}

function parseHead(html: string): ParsedHead {
  const head = (html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html).slice(
    0,
    MAX_HTML_BYTES,
  );

  let title: string | null = null;
  const ogTitle =
    head.match(/<meta\b[^>]*\bproperty\s*=\s*["']og:title["'][^>]*>/i)?.[0] ??
    head.match(/<meta\b[^>]*\bname\s*=\s*["']twitter:title["'][^>]*>/i)?.[0];
  if (ogTitle) {
    const c = attr(ogTitle, "content");
    if (c) title = c;
  }
  if (!title) {
    const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t?.[1]) title = decodeHtmlEntities(t[1]).replace(/\s+/g, " ").trim();
  }
  if (title && title.length > 200) title = title.slice(0, 200);

  let iconHref: string | null = null;
  const linkRe = /<link\b[^>]*>/gi;
  const candidates: { rel: string; href: string; sizes: number }[] = [];
  for (const m of head.matchAll(linkRe)) {
    const tag = m[0];
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    if (
      !rel.includes("icon") &&
      rel !== "shortcut icon" &&
      rel !== "apple-touch-icon"
    ) {
      continue;
    }
    const href = attr(tag, "href");
    if (!href) continue;
    const sizesAttr = attr(tag, "sizes") ?? "";
    const sizeMatch = sizesAttr.match(/(\d+)/);
    candidates.push({
      rel,
      href,
      sizes: sizeMatch ? Number(sizeMatch[1]) : 0,
    });
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const aPref = a.rel === "apple-touch-icon" ? 1 : 0;
      const bPref = b.rel === "apple-touch-icon" ? 1 : 0;
      if (aPref !== bPref) return bPref - aPref;
      return b.sizes - a.sizes;
    });
    iconHref = candidates[0]!.href;
  }

  return { title, iconHref };
}

function normalizeRequestUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

async function readBoundedText(
  res: Response,
  maxBytes: number,
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
        break;
      }
    }
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(
      c.subarray(0, Math.min(c.byteLength, buf.byteLength - offset)),
      offset,
    );
    offset += c.byteLength;
    if (offset >= buf.byteLength) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

async function probeFavicon(faviconUrl: string): Promise<boolean> {
  try {
    const head = await fetchWithTimeout(faviconUrl, { method: "HEAD" });
    if (head.ok) return true;
    if (head.status === 405 || head.status === 501) {
      const get = await fetchWithTimeout(faviconUrl, { method: "GET" });
      try {
        await get.body?.cancel();
      } catch {
        /* noop */
      }
      return get.ok;
    }
    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return jsonResponse(400, { error: "bad_json" });
  }

  if (typeof body.url !== "string") {
    return jsonResponse(400, { error: "missing_url" });
  }

  const target = normalizeRequestUrl(body.url);
  if (!target) {
    return jsonResponse(400, { error: "invalid_url" });
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(target.toString());
  } catch (e) {
    console.error("link-metadata fetch failed", e);
    return jsonResponse(502, { error: "fetch_failed" });
  }

  const finalUrl = (() => {
    try {
      return new URL(res.url || target.toString());
    } catch {
      return target;
    }
  })();

  let title: string | null = null;
  let iconHref: string | null = null;
  const ct = res.headers.get("content-type") ?? "";
  if (
    res.ok &&
    (ct.includes("text/html") || ct.includes("application/xhtml"))
  ) {
    try {
      const html = await readBoundedText(res, MAX_HTML_BYTES);
      const parsed = parseHead(html);
      title = parsed.title;
      iconHref = parsed.iconHref;
    } catch (e) {
      console.error("link-metadata parse failed", e);
    }
  } else {
    try {
      await res.body?.cancel();
    } catch {
      /* noop */
    }
  }

  let faviconUrl: string | null = null;
  if (iconHref) {
    try {
      faviconUrl = new URL(iconHref, finalUrl).toString();
    } catch {
      faviconUrl = null;
    }
  }
  if (!faviconUrl) {
    const fallback = new URL("/favicon.ico", finalUrl).toString();
    if (await probeFavicon(fallback)) faviconUrl = fallback;
  }

  return jsonResponse(200, {
    url: target.toString(),
    finalUrl: finalUrl.toString(),
    domain: finalUrl.hostname.replace(/^www\./i, ""),
    title,
    faviconUrl,
  });
});

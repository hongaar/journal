import { supabase } from "@/lib/supabase";

export type LinkMetadata = {
  /** Original URL passed in (after light normalization, e.g. prefixing https://). */
  url: string;
  /** Final URL after redirects. */
  finalUrl: string;
  /** Hostname without leading "www." */
  domain: string;
  /** Page title fetched from the URL, or `null` when none was found. */
  title: string | null;
  /** Best-effort favicon URL discovered for the page, or `null`. */
  faviconUrl: string | null;
};

export function normalizeUrlInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function linkDisplayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const { data, error } = await supabase.functions.invoke<{
    url?: string;
    finalUrl?: string;
    domain?: string;
    title?: string | null;
    faviconUrl?: string | null;
    error?: string;
  }>("link-metadata", {
    body: { url },
  });
  if (error) throw error;
  if (!data || data.error || !data.url) {
    throw new Error(data?.error ?? "link_metadata_failed");
  }
  return {
    url: data.url,
    finalUrl: data.finalUrl ?? data.url,
    domain: data.domain ?? linkDisplayDomain(data.finalUrl ?? data.url),
    title: data.title ?? null,
    faviconUrl: data.faviconUrl ?? null,
  };
}

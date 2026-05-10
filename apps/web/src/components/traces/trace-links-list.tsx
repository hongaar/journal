import { useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { linkDisplayDomain } from "@/lib/trace-links";
import { useTraceLinks } from "@/lib/use-trace-links";
import type { TraceLink } from "@/types/database";
import { cn } from "@/lib/utils";

type TraceLinksListProps = {
  traceId: string | undefined;
  className?: string;
};

export function TraceLinksList({ traceId, className }: TraceLinksListProps) {
  const linksQuery = useTraceLinks(traceId);
  const links = linksQuery.data ?? [];
  if (links.length === 0) return null;
  return (
    <ul className={cn("flex min-w-0 flex-col gap-2", className)}>
      {links.map((link) => (
        <li key={link.id} className="min-w-0">
          <TraceLinkRow link={link} />
        </li>
      ))}
    </ul>
  );
}

type TraceLinkRowProps = {
  link: TraceLink;
};

export function TraceLinkRow({ link }: TraceLinkRowProps) {
  const domain = link.url ? linkDisplayDomain(link.url) : "";
  const title = (link.title ?? "").trim() || domain || link.url;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border/60 bg-background/40 hover:bg-muted/60 group flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 transition-colors"
    >
      <LinkFavicon faviconUrl={link.favicon_url} domain={domain} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{title}</p>
        {domain ? (
          <p className="text-muted-foreground truncate text-xs leading-tight">
            {domain}
          </p>
        ) : null}
      </div>
      <ExternalLink
        className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </a>
  );
}

type LinkFaviconProps = {
  faviconUrl: string | null;
  domain: string;
  className?: string;
};

export function LinkFavicon({
  faviconUrl,
  domain,
  className,
}: LinkFaviconProps) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(faviconUrl) && !errored;
  return (
    <span
      className={cn(
        "border-border/60 bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border",
        className,
      )}
      aria-label={domain ? `${domain} favicon` : undefined}
    >
      {showImage ? (
        <img
          src={faviconUrl ?? undefined}
          alt=""
          className="size-full object-contain"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <Globe className="size-3.5" aria-hidden />
      )}
    </span>
  );
}

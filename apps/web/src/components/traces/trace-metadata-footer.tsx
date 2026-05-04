import { formatTraceMetadataTimestamp, traceWasModifiedAfterCreate } from "@/lib/trace-dates";

type TraceMetadataFooterProps = {
  createdAt: string;
  updatedAt: string;
  creatorDisplayName: string | null | undefined;
  modifierDisplayName: string | null | undefined;
};

export function TraceMetadataFooter({
  createdAt,
  updatedAt,
  creatorDisplayName,
  modifierDisplayName,
}: TraceMetadataFooterProps) {
  const byCreator = creatorDisplayName?.trim();
  const byModifier = modifierDisplayName?.trim();
  const showModified = traceWasModifiedAfterCreate(createdAt, updatedAt);
  return (
    <footer className="text-muted-foreground border-border/60 mt-4 border-t pt-3 text-xs leading-relaxed">
      <p>
        Created {formatTraceMetadataTimestamp(createdAt)}
        {byCreator ? ` by ${byCreator}` : null}
      </p>
      {showModified ? (
        <p className="mt-1">
          Modified {formatTraceMetadataTimestamp(updatedAt)}
          {byModifier ? ` by ${byModifier}` : null}
        </p>
      ) : null}
    </footer>
  );
}

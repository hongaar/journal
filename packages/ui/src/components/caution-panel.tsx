import * as React from "react";

import { cn } from "../lib/utils";

type CautionPanelProps = React.ComponentProps<"div"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
};

/**
 * Amber “caution” surface (e.g. transfer ownership, danger zone). Matches
 * `rounded-xl border border-amber-500/25 bg-amber-500/5 p-4`.
 */
function CautionPanel({
  className,
  title,
  description,
  children,
  ...props
}: CautionPanelProps) {
  return (
    <div
      data-slot="caution-panel"
      className={cn(
        "rounded-xl border border-amber-500/25 bg-amber-500/5 p-4",
        className,
      )}
      {...props}
    >
      <h3 className="text-foreground text-sm font-medium">{title}</h3>
      {description ? (
        <div className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {description}
        </div>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export { CautionPanel, type CautionPanelProps };

import { flip, offset, shift, size, type Middleware } from "@floating-ui/dom";

/** Space from map anchor (marker center) to panel — matches new-trace floating form. */
export const MAP_ANCHOR_PANEL_GAP_PX = 28;

/** Floating UI middleware for anchored map panels (new trace dialog, marker hover). */
export function mapAnchorPanelMiddleware(): Middleware[] {
  return [
    offset(MAP_ANCHOR_PANEL_GAP_PX),
    flip({
      fallbackPlacements: ["left", "top", "bottom"],
    }),
    shift({ padding: 12, crossAxis: true }),
    size({
      padding: 12,
      apply({ availableHeight, availableWidth, elements }) {
        const maxH = Math.max(140, availableHeight);
        const maxW = Math.min(400, Math.max(288, availableWidth));
        Object.assign(elements.floating.style, {
          maxHeight: `${maxH}px`,
          maxWidth: `${maxW}px`,
        });
      },
    }),
  ];
}

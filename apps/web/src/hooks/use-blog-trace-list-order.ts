import type { BlogTraceListOrder } from "@/lib/blog-trace-list-order";
import {
  readBlogTraceListOrder,
  writeBlogTraceListOrder,
} from "@/lib/blog-trace-list-order";
import { useCallback, useEffect, useState } from "react";

export function useBlogTraceListOrder(journalId: string | null) {
  const [order, setOrderState] = useState<BlogTraceListOrder>(() =>
    readBlogTraceListOrder(journalId),
  );

  useEffect(() => {
    setOrderState(readBlogTraceListOrder(journalId));
  }, [journalId]);

  const setOrder = useCallback(
    (next: BlogTraceListOrder) => {
      if (!journalId) return;
      writeBlogTraceListOrder(journalId, next);
      setOrderState(next);
    },
    [journalId],
  );

  return { order, setOrder };
}

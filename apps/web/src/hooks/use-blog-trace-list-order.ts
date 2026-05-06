import type { BlogTraceListOrder } from "@/lib/blog-trace-list-order";
import {
  readBlogTraceListOrder,
  writeBlogTraceListOrder,
} from "@/lib/blog-trace-list-order";
import { useCallback, useState } from "react";

export function useBlogTraceListOrder(journalId: string | null) {
  const [order, setOrderState] = useState<BlogTraceListOrder>(() =>
    readBlogTraceListOrder(journalId),
  );
  const [prevJournalId, setPrevJournalId] = useState(journalId);
  if (journalId !== prevJournalId) {
    setPrevJournalId(journalId);
    setOrderState(readBlogTraceListOrder(journalId));
  }

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

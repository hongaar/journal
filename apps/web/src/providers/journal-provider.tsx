import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultJournalIcon,
  normalizeJournalIconForPersist,
} from "@/lib/journal-display-icon";
import { supabase } from "@/lib/supabase";
import type { Journal } from "@/types/database";
import {
  useAuth,
  getStoredActiveJournalId,
  setStoredActiveJournalId,
} from "./auth-provider";

type JournalContextValue = {
  journals: Journal[];
  activeJournal: Journal | null;
  activeJournalId: string | null;
  setActiveJournalId: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
  createJournal: (
    name: string,
    iconEmoji?: string | null,
  ) => Promise<{ journal: Journal | null; error: Error | null }>;
};

const JournalContext = createContext<JournalContextValue | null>(null);

async function fetchJournalsForUser(userId: string): Promise<Journal[]> {
  const { data, error } = await supabase
    .from("journal_members")
    .select("journal_id, journals(*)")
    .eq("user_id", userId);

  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    journal_id: string;
    journals: Journal | null;
  }[];
  return rows.map((r) => r.journals).filter((j): j is Journal => Boolean(j));
}

async function fetchProfileDefaultJournal(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("default_journal_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.default_journal_id ?? null;
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeJournalId, setActiveJournalIdState] = useState<string | null>(
    null,
  );

  const journalsQuery = useQuery({
    queryKey: ["journals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      return fetchJournalsForUser(user.id);
    },
    enabled: Boolean(user) && !authLoading,
  });

  const journals = useMemo(
    () => journalsQuery.data ?? [],
    [journalsQuery.data],
  );

  useEffect(() => {
    if (!user || journals.length === 0) {
      setActiveJournalIdState(null);
      return;
    }
    const stored = getStoredActiveJournalId();
    if (stored && journals.some((j) => j.id === stored)) {
      setActiveJournalIdState(stored);
      return;
    }
    void (async () => {
      try {
        const def = await fetchProfileDefaultJournal(user.id);
        if (def && journals.some((j) => j.id === def)) {
          setActiveJournalIdState(def);
          setStoredActiveJournalId(def);
          return;
        }
      } catch {
        /* fall through */
      }
      const first = journals[0];
      if (first) {
        setActiveJournalIdState(first.id);
        setStoredActiveJournalId(first.id);
      }
    })();
  }, [user, journals]);

  const setActiveJournalId = useCallback((id: string) => {
    setActiveJournalIdState(id);
    setStoredActiveJournalId(id);
  }, []);

  const activeJournal = useMemo(
    () => journals.find((j) => j.id === activeJournalId) ?? null,
    [journals, activeJournalId],
  );

  const createJournal = useCallback(
    async (name: string, iconEmoji?: string | null) => {
      if (!user) return { journal: null, error: new Error("Not signed in") };
      const icon_emoji = normalizeJournalIconForPersist(
        iconEmoji ?? defaultJournalIcon(false),
        false,
      );
      const { data: journal, error: jErr } = await supabase
        .from("journals")
        .insert({
          name,
          created_by_user_id: user.id,
          is_personal: false,
          icon_emoji,
        })
        .select()
        .single();
      if (jErr || !journal) return { journal: null, error: jErr as Error };

      const { error: mErr } = await supabase.from("journal_members").insert({
        journal_id: journal.id,
        user_id: user.id,
        role: "owner",
      });
      if (mErr) return { journal: null, error: mErr as Error };

      await queryClient.invalidateQueries({ queryKey: ["journals", user.id] });
      setActiveJournalId(journal.id);
      return { journal, error: null };
    },
    [user, queryClient, setActiveJournalId],
  );

  const value = useMemo<JournalContextValue>(
    () => ({
      journals,
      activeJournal,
      activeJournalId,
      setActiveJournalId,
      loading: journalsQuery.isLoading || authLoading,
      refetch: async () => {
        await journalsQuery.refetch();
      },
      createJournal,
    }),
    [
      journals,
      activeJournal,
      activeJournalId,
      setActiveJournalId,
      journalsQuery,
      authLoading,
      createJournal,
    ],
  );

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}

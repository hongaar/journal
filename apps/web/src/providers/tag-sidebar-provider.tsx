import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Tag } from "@/types/database";

export type TagSidebarRegistration = {
  tags: Tag[];
  filterTagIds: Set<string>;
  setFilterTagIds: (action: SetStateAction<Set<string>>) => void;
  onNewTag: () => void;
  onEditTag: (tag: Tag) => void;
};

type Ctx = {
  registration: TagSidebarRegistration | null;
  setRegistration: (r: TagSidebarRegistration | null) => void;
};

const TagSidebarContext = createContext<Ctx | null>(null);

export function TagSidebarProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] =
    useState<TagSidebarRegistration | null>(null);
  const value = useMemo(
    () => ({ registration, setRegistration }),
    [registration],
  );
  return (
    <TagSidebarContext.Provider value={value}>
      {children}
    </TagSidebarContext.Provider>
  );
}

export function useTagSidebarRegistration(): Ctx["setRegistration"] {
  const ctx = useContext(TagSidebarContext);
  if (!ctx) {
    throw new Error("TagSidebarProvider missing");
  }
  return ctx.setRegistration;
}

export function useRegisteredTagSidebar(): TagSidebarRegistration | null {
  const ctx = useContext(TagSidebarContext);
  if (!ctx) {
    throw new Error("TagSidebarProvider missing");
  }
  return ctx.registration;
}

function filterTagIdsKey(ids: Set<string>) {
  return [...ids].sort().join("|");
}

/** Registers tag filter actions with the app sidebar while mounted. */
export function useMountTagSidebarRegistration(opts: TagSidebarRegistration) {
  const setRegistration = useTagSidebarRegistration();
  const optsRef = useRef(opts);
  const { tags, filterTagIds, setFilterTagIds } = opts;
  const filterKey = filterTagIdsKey(filterTagIds);
  const tagIdsKey = tags.map((t) => t.id).join("|");

  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    setRegistration({
      tags,
      filterTagIds,
      setFilterTagIds,
      onNewTag: () => optsRef.current.onNewTag(),
      onEditTag: (tag) => optsRef.current.onEditTag(tag),
    });
    return () => setRegistration(null);
  }, [
    setRegistration,
    tags,
    filterTagIds,
    filterKey,
    tagIdsKey,
    setFilterTagIds,
  ]);
}

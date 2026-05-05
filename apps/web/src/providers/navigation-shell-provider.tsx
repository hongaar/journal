import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { NewJournalDialog } from "@/components/layout/new-journal-dialog";
import { NAV_SIDEBAR_OPEN_STORAGE_KEY } from "@/lib/navigation-shell-layout";

export type NavigationShellContextValue = {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  openNewJournalDialog: () => void;
};

const NavigationShellContext =
  createContext<NavigationShellContextValue | null>(null);

function readStoredSidebarOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(NAV_SIDEBAR_OPEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function NavigationShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(readStoredSidebarOpen);
  const [newJournalOpen, setNewJournalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        NAV_SIDEBAR_OPEN_STORAGE_KEY,
        sidebarOpen ? "1" : "0",
      );
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [sidebarOpen]);

  const openNewJournalDialog = useCallback(() => {
    setNewJournalOpen(true);
  }, []);

  const value = useMemo(
    (): NavigationShellContextValue => ({
      sidebarOpen,
      setSidebarOpen,
      openNewJournalDialog,
    }),
    [sidebarOpen, openNewJournalDialog],
  );

  return (
    <NavigationShellContext.Provider value={value}>
      {children}
      <NewJournalDialog
        open={newJournalOpen}
        onOpenChange={setNewJournalOpen}
      />
    </NavigationShellContext.Provider>
  );
}

export function useNavigationShell(): NavigationShellContextValue {
  const ctx = useContext(NavigationShellContext);
  if (!ctx) {
    throw new Error(
      "useNavigationShell must be used inside NavigationShellProvider",
    );
  }
  return ctx;
}

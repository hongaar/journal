import { useTheme } from "next-themes";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

export function AppSettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const current = (theme === "light" || theme === "dark" ? theme : "system") as ThemeChoice;

  function pick(next: ThemeChoice) {
    setTheme(next);
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-lg">
        <FloatingPanel className="p-5 sm:p-6">
          <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">Appearance and other preferences.</p>

          <section className="mt-8">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">Theme</h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Choose a color scheme. System follows your device setting.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  { id: "light" as const, label: "Light" },
                  { id: "dark" as const, label: "Dark" },
                  { id: "system" as const, label: "System" },
                ] as const
              ).map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant={current === id ? "default" : "outline"}
                  size="sm"
                  className={cn("rounded-xl", current === id && "pointer-events-none")}
                  onClick={() => pick(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {current === "system" && resolvedTheme ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Active appearance: <span className="text-foreground font-medium capitalize">{resolvedTheme}</span>
              </p>
            ) : null}
          </section>
        </FloatingPanel>
      </div>
    </div>
  );
}

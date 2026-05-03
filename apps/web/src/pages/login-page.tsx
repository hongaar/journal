import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatingPanel } from "@/components/layout/floating-panel";

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSignIn() {
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(err.message);
  }

  async function onSignUp() {
    setBusy(true);
    setError(null);
    const { error: err } = await signUp(email, password);
    setBusy(false);
    if (err) setError(err.message);
    else setError("Check your email to confirm your account, if required by your project.");
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 20% 20%, oklch(0.55 0.08 158 / 0.18), transparent 50%),
            radial-gradient(ellipse 100% 60% at 80% 70%, oklch(0.55 0.06 250 / 0.14), transparent 45%),
            linear-gradient(165deg, oklch(0.94 0.02 88) 0%, oklch(0.9 0.025 95) 100%)
          `,
        }}
        aria-hidden
      />
      <FloatingPanel className="relative z-10 w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight italic">Journal</h1>
          <p className="text-muted-foreground mt-2 text-sm">Sign in to your travel journal.</p>
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/80 p-1">
            <TabsTrigger value="signin" className="rounded-lg">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="signup" className="rounded-lg">
              Sign up
            </TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-4 pt-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button className="h-11 w-full rounded-xl" disabled={busy} onClick={() => void onSignIn()}>
              Sign in
            </Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-4 pt-5">
            <div className="space-y-2">
              <Label htmlFor="email2">Email</Label>
              <Input
                id="email2"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password2">Password</Label>
              <Input
                id="password2"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
            {error ? <p className="text-muted-foreground text-sm">{error}</p> : null}
            <Button className="h-11 w-full rounded-xl" disabled={busy} onClick={() => void onSignUp()}>
              Create account
            </Button>
          </TabsContent>
        </Tabs>
        <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
          Configure <code className="text-foreground rounded bg-muted/80 px-1 py-0.5 text-[0.7rem]">VITE_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="text-foreground rounded bg-muted/80 px-1 py-0.5 text-[0.7rem]">VITE_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          in <code className="text-foreground rounded bg-muted/80 px-1 py-0.5 text-[0.7rem]">apps/web/.env</code> (see
          repository README).
        </p>
      </FloatingPanel>
    </div>
  );
}

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Journal</CardTitle>
          <CardDescription>Sign in to your travel journal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                />
              </div>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <Button className="w-full" disabled={busy} onClick={() => void onSignIn()}>
                Sign in
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email2">Email</Label>
                <Input
                  id="email2"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                />
              </div>
              {error ? <p className="text-muted-foreground text-sm">{error}</p> : null}
              <Button className="w-full" disabled={busy} onClick={() => void onSignUp()}>
                Create account
              </Button>
            </TabsContent>
          </Tabs>
          <p className="text-muted-foreground mt-4 text-center text-xs">
            Configure <code className="text-foreground">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-foreground">VITE_SUPABASE_PUBLISHABLE_KEY</code> in{" "}
            <code className="text-foreground">apps/web/.env</code> (see repository README).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

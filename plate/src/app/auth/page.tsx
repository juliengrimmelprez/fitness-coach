"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  accountsSnapshot,
  forgetAccount,
  parseAccounts,
  rememberSession,
  subscribeAccounts,
  type RememberedAccount,
} from "@/lib/accounts";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const accountsRaw = useSyncExternalStore(subscribeAccounts, accountsSnapshot, () => "[]");
  const accounts = useMemo(() => parseAccounts(accountsRaw), [accountsRaw]);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) toast.error("Sign-in link failed or expired. Try again.");
  }, []);

  // refresh() re-runs the server layout so it sees the new session cookie.
  const goToApp = () => {
    router.replace("/today");
    router.refresh();
  };

  async function google(loginHint?: string) {
    setBusy("google");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: loginHint ? { login_hint: loginHint } : undefined,
      },
    });
    if (error) {
      toast.error(error.message);
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    if (mode === "signin") {
      const { data, error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        setBusy(null);
        return;
      }
      rememberSession(data.session);
      goToApp();
    } else {
      const { data, error } = await supabaseBrowser().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast.error(error.message);
        setBusy(null);
        return;
      }
      if (data.session) {
        rememberSession(data.session);
        goToApp();
      } else {
        toast.success("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setBusy(null);
      }
    }
  }

  async function continueAs(account: RememberedAccount) {
    setBusy(account.userId);
    if (account.refreshToken) {
      const { data, error } = await supabaseBrowser().auth.setSession({
        access_token: account.accessToken ?? "",
        refresh_token: account.refreshToken,
      });
      if (!error && data.session) {
        rememberSession(data.session);
        goToApp();
        return;
      }
    }
    // Saved session expired: fall back to a normal sign-in for that account.
    setBusy(null);
    if (account.provider === "google") {
      await google(account.email);
    } else {
      setMode("signin");
      setEmail(account.email);
      toast.info("Session expired. Enter your password to continue.");
      passwordRef.current?.focus();
    }
  }

  function forget(account: RememberedAccount) {
    forgetAccount(account.userId);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary">
          <div className="size-6 rounded-full border-[3px] border-primary-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Plate</h1>
        <p className="text-sm text-muted-foreground">Snap your meal. Know your macros.</p>
      </div>

      {accounts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Continue as</h2>
          <Card className="py-0">
            <CardContent className="divide-y px-0">
              {accounts.map((a) => (
                <div key={a.userId} className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => continueAs(a)}
                    disabled={busy !== null}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium uppercase">
                      {a.email[0]}
                    </span>
                    <span className="truncate text-sm">{a.email}</span>
                    {a.provider === "google" && <Badge variant="secondary">Google</Badge>}
                    {busy === a.userId && <Loader2 className="size-4 animate-spin" />}
                  </button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Forget ${a.email}`} onClick={() => forget(a)}>
                    <X />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <Button variant="outline" size="lg" onClick={() => google()} disabled={busy !== null}>
        {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleMark />}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" /> or <Separator className="flex-1" />
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            ref={passwordRef}
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
          {busy === "email" && <Loader2 className="animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}

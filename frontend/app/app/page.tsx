"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Workspace from "@/app/components/Workspace";

export default function AppRoot() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="auth-wrap" />;
  if (!session) return <AuthForm />;
  return <Workspace session={session} client={supabase} key={session.user.id} />;
}

function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) setInfo("Check your email to confirm, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">§</div>
        <h1 className="auth-title">SignD</h1>
        <p className="auth-sub">
          {mode === "signin" ? "Sign in to your documents" : "Create your account"}
        </p>
        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {err && <div className="auth-msg err">{err}</div>}
        {info && <div className="auth-msg info">{info}</div>}
        <button className="auth-btn" disabled={busy || !email || !password} onClick={submit}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <div className="auth-switch">
          {mode === "signin" ? (
            <>New here? <button onClick={() => { setMode("signup"); setErr(""); }}>Create an account</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode("signin"); setErr(""); }}>Sign in</button></>
          )}
        </div>
        <div className="auth-switch">
          <a className="auth-home" href="/demo">Or try the demo, no account needed &rarr;</a>
        </div>
        <a className="auth-home" href="/">&larr; Back to home</a>
      </div>
    </div>
  );
}

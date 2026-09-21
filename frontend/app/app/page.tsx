"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const LANGS: [string, string][] = [
  ["auto", "Auto"],
  ["English", "English"],
  ["French", "Français"],
  ["Spanish", "Español"],
  ["Chinese", "中文"],
  ["Portuguese", "Português"],
  ["German", "Deutsch"],
  ["Arabic", "العربية"],
  ["Hindi", "हिन्दी"],
];

type Source = { doc_id: string; score: number | null; text: string };
type Flag = { title: string; detail: string };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[]; flags?: Flag[] };
type Doc = { doc_id: string; filename: string; chunks: number };

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
  return <Workspace session={session} key={session.user.id} />;
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
        <a className="auth-home" href="/">&larr; Back to home</a>
      </div>
    </div>
  );
}

function Workspace({ session }: { session: Session }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [language, setLanguage] = useState("auto");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const auth = () => ({ Authorization: `Bearer ${session.access_token}` });

  async function loadDocs() {
    try {
      const r = await fetch(`${API}/documents`, { headers: auth() });
      const d = await r.json();
      setDocs(d.documents || []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadDocs();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function upload(file: File) {
    setUploading(true);
    setStatus(`Ingesting ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/documents`, { method: "POST", headers: auth(), body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      await loadDocs();
      setSelected(data.doc_id);
      setMessages([]);
      setStatus(`Reviewing "${data.filename}" for risky clauses…`);
      try {
        const rr = await fetch(
          `${API}/documents/${data.doc_id}/risks?language=${encodeURIComponent(language)}`,
          { headers: auth() }
        );
        const rd = await rr.json();
        setMessages([{ role: "assistant", content: "", flags: rd.flags || [] }]);
      } catch {
        /* best-effort */
      }
      setStatus(`Indexed "${data.filename}" · ${data.chunks} chunks`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function askWith(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify({ question: q, language, document_id: selected }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    await fetch(`${API}/documents/${id}`, { method: "DELETE", headers: auth() });
    if (selected === id) {
      setSelected(null);
      setMessages([]);
    }
    loadDocs();
  }

  function select(id: string | null) {
    setSelected(id);
    setMessages([]);
    setStatus("");
  }

  const activeName = selected ? docs.find((d) => d.doc_id === selected)?.filename : "All documents";

  return (
    <div className="ws">
      <aside className="ws-side">
        <a className="ws-brand" href="/"><span className="logo">§</span> SignD</a>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <button className="ws-upload" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Ingesting…" : "＋ Upload a contract"}
        </button>

        <div className="ws-doclabel">Your documents</div>
        <button className={`ws-doc ${selected === null ? "active" : ""}`} onClick={() => select(null)}>
          <span className="ws-doc-name">All documents</span>
        </button>
        {docs.map((d) => (
          <div key={d.doc_id} className={`ws-doc ${selected === d.doc_id ? "active" : ""}`}>
            <button className="ws-doc-main" onClick={() => select(d.doc_id)}>
              <span className="ws-doc-name">{d.filename}</span>
              <span className="ws-doc-meta">{d.chunks} chunks</span>
            </button>
            <button className="ws-doc-del" title="Delete" onClick={() => del(d.doc_id)}>×</button>
          </div>
        ))}
        {docs.length === 0 && <div className="ws-empty">No documents yet.</div>}

        <div className="ws-user">
          <span className="ws-email">{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>

      <main className="ws-main">
        <header className="ws-top">
          <div className="ws-top-title">{activeName}</div>
          <label className="lang">
            <span className="lang-label">Answers in</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          {messages.length > 0 && (
            <button className="ghost-btn" onClick={() => window.print()}>Export</button>
          )}
        </header>

        <div className="print-header">SignD · Contract Analysis</div>
        {status && <div className="statusbar">{status}</div>}

        <div className="thread">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-logo">§</div>
              {docs.length === 0 ? (
                <>
                  <h1>Upload your first contract</h1>
                  <p>Add a lease, contract, or terms of service. SignD will flag the risky clauses and answer your questions, in any language.</p>
                </>
              ) : (
                <>
                  <h1>Ask about <span className="hl">{activeName}</span></h1>
                  <p>Ask anything in plain language: penalties, deadlines, what happens if you cancel. Every answer cites the exact clause.</p>
                </>
              )}
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`row ${m.role}`}>
                {m.role === "assistant" && <div className="avatar">§</div>}
                <div className="col">
                  {m.flags !== undefined ? (
                    <div className="risk-card">
                      <div className="risk-head"><span className="risk-ic">⚠</span> Things to watch out for</div>
                      {m.flags.length === 0 ? (
                        <p className="risk-none">Nothing major stood out in this document.</p>
                      ) : (
                        <ul className="flags">
                          {m.flags.map((f, k) => (
                            <li key={k}><strong>{f.title}.</strong> {f.detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="bubble">{m.content}</div>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <details className="sources">
                      <summary><span className="cite-dot" /> {m.sources.length} sources</summary>
                      <div className="src-list">
                        {m.sources.map((s, j) => (
                          <div key={j} className="src">
                            <div className="src-head">
                              <span className="src-doc">{s.doc_id.slice(0, 8)}</span>
                              {s.score != null && <span className="src-score">{s.score.toFixed(2)}</span>}
                            </div>
                            <p>{s.text.slice(0, 240)}…</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="row assistant">
              <div className="avatar">§</div>
              <div className="col"><div className="bubble typing"><span></span><span></span><span></span></div></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <button className="attach" title="Add a document" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <input
              className="qinput"
              value={input}
              placeholder="Ask about your contract…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askWith(input)}
            />
            <button className="send" disabled={loading || !input.trim()} onClick={() => askWith(input)} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
          <div className="composer-note">SignD explains your document; it is not legal advice.</div>
        </div>
      </main>
    </div>
  );
}

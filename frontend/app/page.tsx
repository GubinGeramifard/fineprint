"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const EXAMPLES = [
  "Can my landlord raise the rent during the lease?",
  "What happens if I end the lease early?",
  "Does this lease renew automatically?",
];

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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [docCount, setDocCount] = useState<number | null>(null);
  const [language, setLanguage] = useState("auto");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/documents`)
      .then((r) => r.json())
      .then((d) => setDocCount(d.documents?.length ?? 0))
      .catch(() => setDocCount(null));
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
      const res = await fetch(`${API}/documents`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setDocCount((c) => (c ?? 0) + 1);
      setStatus(`Reviewing "${data.filename}" for risky clauses…`);
      try {
        const rr = await fetch(
          `${API}/documents/${data.doc_id}/risks?language=${encodeURIComponent(language)}`
        );
        const rd = await rr.json();
        setMessages((m) => [...m, { role: "assistant", content: "", flags: rd.flags || [] }]);
      } catch {
        /* risk analysis is best-effort */
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, language }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${(err as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>§</span>
          <div>
            <div className="brand-name">FinePrint</div>
            <div className="brand-sub">Understand what you signed</div>
          </div>
        </div>
        <div className="topbar-right">
          <label className="lang">
            <span className="lang-label">Answers in</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGS.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {docCount != null && (
            <span className="pill">{docCount} document{docCount === 1 ? "" : "s"} indexed</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <button className="ghost-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Ingesting…" : "＋ Upload a contract"}
          </button>
        </div>
      </header>

      {status && <div className="statusbar">{status}</div>}

      <main className="thread">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-logo">§</div>
            <h1>Understand <span className="hl">what you signed</span></h1>
            <p>Upload a lease, contract, or terms of service and ask plain-English questions. Every answer points to the exact clause, and flags anything risky.</p>
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="example" onClick={() => askWith(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`row ${m.role}`}>
              {m.role === "assistant" && <div className="avatar">§</div>}
              <div className="col">
                {m.flags !== undefined ? (
                  <div className="risk-card">
                    <div className="risk-head">
                      <span className="risk-ic">⚠</span> Things to watch out for
                    </div>
                    {m.flags.length === 0 ? (
                      <p className="risk-none">Nothing major stood out in this document.</p>
                    ) : (
                      <ul className="flags">
                        {m.flags.map((f, k) => (
                          <li key={k}>
                            <strong>{f.title}.</strong> {f.detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="bubble">{m.content}</div>
                )}
                {m.sources && m.sources.length > 0 && (
                  <details className="sources">
                    <summary>
                      <span className="cite-dot" /> {m.sources.length} sources
                    </summary>
                    <div className="src-list">
                      {m.sources.map((s, j) => (
                        <div key={j} className="src">
                          <div className="src-head">
                            <span className="src-doc">{s.doc_id}</span>
                            {s.score != null && (
                              <span className="src-score">{s.score.toFixed(2)}</span>
                            )}
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
            <div className="col">
              <div className="bubble typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </main>

      <div className="composer-wrap">
        <div className="composer">
          <button
            className="attach"
            title="Add a document"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <input
            className="qinput"
            value={input}
            placeholder="Ask about your contract…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") askWith(input);
            }}
          />
          <button
            className="send"
            disabled={loading || !input.trim()}
            onClick={() => askWith(input)}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
        <div className="composer-note">FinePrint explains your document; it is not legal advice.</div>
      </div>
    </div>
  );
}

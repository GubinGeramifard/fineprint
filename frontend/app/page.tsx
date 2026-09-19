"use client";

import { useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Source = { doc_id: string; score: number | null; text: string };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setStatus(`Ingesting ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/documents`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setStatus(`Indexed "${data.filename}" (${data.chunks} chunks). Ask away.`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function ask() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
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
    <main className="wrap">
      <header className="head">
        <h1>DocuChat</h1>
        <p>Ask questions over your documents. Answers are grounded in the sources, with citations.</p>
      </header>

      <div className="uploader">
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
        <button className="btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Ingesting…" : "Upload a document"}
        </button>
        {status && <span className="status">{status}</span>}
      </div>

      <div className="chat">
        {messages.length === 0 && (
          <div className="empty">Upload a PDF or text file, then ask a question about it.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.content}</div>
            {m.sources && m.sources.length > 0 && (
              <details className="sources">
                <summary>{m.sources.length} sources</summary>
                {m.sources.map((s, j) => (
                  <div key={j} className="src">
                    <span className="srcmeta">
                      {s.doc_id}
                      {s.score != null ? ` · relevance ${s.score.toFixed(2)}` : ""}
                    </span>
                    {s.text.slice(0, 240)}…
                  </div>
                ))}
              </details>
            )}
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="bubble typing">Thinking…</div>
          </div>
        )}
      </div>

      <div className="composer">
        <input
          className="qinput"
          value={input}
          placeholder="Ask a question…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
        />
        <button className="btn send" disabled={loading || !input.trim()} onClick={ask}>
          Send
        </button>
      </div>
    </main>
  );
}

const GITHUB = "https://github.com/GubinGeramifard/fineprint";

const FEATURES = [
  {
    title: "Any contract",
    body: "Upload a PDF, Word, or text file, in any language. It's ready to query in seconds.",
    icon: (
      <path d="M12 5v10m0-10l-4 4m4-4l4 4M5 19h14" />
    ),
  },
  {
    title: "Grounded answers",
    body: "Every answer cites the exact clause it came from, so you can trust and verify it.",
    icon: <path d="M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-5-5" />,
  },
  {
    title: "Automatic risk flags",
    body: "The moment you upload, SignD surfaces penalties, auto-renewal, hidden fees, and other easy-to-miss terms.",
    icon: <path d="M12 3l9 16H3L12 3zm0 6v5m0 3v.5" />,
  },
  {
    title: "Any language",
    body: "Upload in one language and ask in another. Answers come back in the language you choose.",
    icon: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />,
  },
  {
    title: "No hallucinations",
    body: "SignD only answers from your document. If the answer isn't there, it tells you.",
    icon: <path d="M20 6L9 17l-5-5" />,
  },
  {
    title: "Free & open source",
    body: "No account, no cost. The entire project is on GitHub for anyone to read.",
    icon: <path d="M8 18l-6-6 6-6m8 12l6-6-6-6" />,
  },
];

const STEPS = [
  { n: "1", title: "Upload", body: "Add a lease, contract, or terms of service, in any language." },
  { n: "2", title: "Ask", body: "Ask anything in plain language. SignD reads the whole document for you." },
  { n: "3", title: "Understand", body: "Get a clear answer with the exact clause it's based on, plus flagged risks." },
];

export default function Landing() {
  return (
    <div className="lp">
      <nav className="lp-nav">
        <a className="lp-brand" href="/">
          <span className="lp-logo">§</span> SignD
        </a>
        <div className="lp-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
          <a className="lp-btn" href="/app">Open the app</a>
        </div>
      </nav>

      <header className="lp-hero">
        <div className="lp-hero-copy">
          <h1>
            Understand <span className="hl">what you signed</span>.
          </h1>
          <p>
            Upload a lease, contract, or terms of service and ask plain-English questions.
            SignD answers in seconds, cites the exact clause, and flags anything risky, in any language.
          </p>
          <div className="lp-cta">
            <a className="lp-primary" href="/app">Try it free &rarr;</a>
            <a className="lp-ghost" href={GITHUB} target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
          <p className="lp-note">No account, no cost. Your document never leaves the session.</p>
        </div>

        <div className="lp-preview" aria-hidden="true">
          <div className="lp-prev-q">What happens if I end the lease early?</div>
          <div className="lp-prev-a">
            You would owe a penalty equal to two months of rent, and remain responsible for rent
            until the unit is re-rented. You must give at least 60 days written notice.
            <div className="lp-prev-src">§ lease · clause 7</div>
          </div>
          <div className="lp-prev-flag">⚠ Auto-renewal: renews unless you give 60 days notice</div>
        </div>
      </header>

      <section id="features" className="lp-section">
        <div className="lp-sec-head">
          <span className="lp-kick">Features</span>
          <h2>Everything you need to read the fine print</h2>
        </div>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <div className="lp-card" key={f.title}>
              <span className="lp-ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="lp-section lp-how">
        <div className="lp-sec-head">
          <span className="lp-kick">How it works</span>
          <h2>Three steps</h2>
        </div>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div className="lp-step" key={s.n}>
              <span className="lp-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-band">
        <h2>Know exactly what you&rsquo;re signing.</h2>
        <a className="lp-primary" href="/app">Launch SignD &rarr;</a>
      </section>

      <footer className="lp-footer">
        <div className="lp-foot-left">
          <a className="lp-brand" href="/"><span className="lp-logo">§</span> SignD</a>
          <span>Understand what you signed.</span>
        </div>
        <div className="lp-foot-right">
          <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
          <a href="/app">Open the app</a>
        </div>
      </footer>
      <div className="lp-legal">SignD explains your document; it is not legal advice.</div>
    </div>
  );
}

# DocuChat

A full-stack RAG (retrieval-augmented generation) application: upload documents, ask
questions in natural language, and get answers grounded in your documents with citations.

Built to be **provably better than keyword search** — see the benchmark below.

## Why this project

Finding a specific fact buried in a pile of documents is a real, everyday problem, and
keyword search (Ctrl+F, basic search bars) fails when you don't remember the exact words.
DocuChat retrieves by *meaning* and answers directly.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js, TypeScript |
| Backend | FastAPI (Python 3.13) |
| Vector store | PostgreSQL + pgvector |
| Queue | Redis + RQ (async ingestion) |
| AI | Cohere (embeddings, rerank, generation) |
| Infra | Supabase (Postgres), Upstash (Redis), Vercel + Render (deploy) |

## Architecture

```
Next.js/TS  ->  FastAPI  ->  Postgres + pgvector   (chunks + embeddings)
                   |     ->  Redis (RQ) -> worker   (async ingestion)
                   |     ->  Cohere API             (embed / rerank / generate)
```

## The benchmark (the point of the project)

Question: is semantic retrieval actually better than keyword search?

- **Baseline:** BM25 keyword retrieval.
- **Ours:** Cohere embeddings + rerank.
- **Test set:** labeled question -> relevant-passage pairs.
- **Metrics:** Hit@k, MRR@10, NDCG@10, with a Wilcoxon signed-rank significance test.

### Results (150 queries, 600-document corpus)

| Metric  | BM25 (keyword) | Cohere embeddings | Embeddings + Rerank |
|---------|:--------------:|:-----------------:|:-------------------:|
| Hit@1   | 0.800          | 0.833             | **0.940**           |
| MRR@10  | 0.856          | 0.884             | **0.955**           |
| NDCG@10 | 0.884          | 0.909             | **0.961**           |

SQuAD questions share vocabulary with their source passage, so keyword search is already a
strong baseline and embeddings win only slightly (not significant, p = 0.15). Adding a
**Cohere reranker** gives a large, statistically significant lift: **+17.5% Hit@1 and
+11.3% MRR@10 over dense retrieval alone (Wilcoxon signed-rank, p = 2e-4)**.

Reproduce: `python -m benchmark.run --rerank`. The harness lives in `benchmark/`.

## Milestones

- [x] 1. Scaffold + FastAPI skeleton
- [x] 2. Ingestion: upload -> chunk -> embed -> store (Cohere embeddings, local SQLite vector store)
- [x] 3. Query: retrieve -> Cohere rerank -> grounded LLM answer with citations
- [x] 4a. FastAPI endpoints: POST/GET /documents, POST /chat
- [x] 4b. Next.js/TS chat UI (upload + grounded chat with sources)
- [ ] 5. Async ingestion via Redis + RQ worker
- [x] 6. Benchmark harness + results (semantic vs keyword vs rerank, with significance test)
- [ ] 7. Tests, README polish, deploy
- [ ] 8. Swap local store -> Postgres + pgvector (Supabase)

## Run locally

**Backend** (from `backend/`, with `.env` holding your `COHERE_API_KEY`):

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # Windows; use .venv/bin on macOS/Linux
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

**Frontend** (from `frontend/`, in a second terminal):

```bash
npm install
npm run dev        # http://localhost:3000
```

Open http://localhost:3000, upload a PDF or text file, and ask questions about it.
The frontend talks to the API at `http://localhost:8000` (override with `NEXT_PUBLIC_API_URL`).

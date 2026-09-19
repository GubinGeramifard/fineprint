"""Benchmark: semantic retrieval (Cohere embeddings) vs keyword retrieval (BM25).

Ground truth: each SQuAD question's source paragraph is the one relevant document.
Metrics: Hit@1, Hit@5, MRR@10, NDCG@10. Significance: Wilcoxon signed-rank on
per-query reciprocal rank.

Run (from backend/):  python -m benchmark.run
"""
import argparse
import math
import re
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi
from scipy.stats import wilcoxon

from app.services.embeddings import CohereEmbedder
from benchmark.dataset import load

CACHE = Path("benchmark/cache")
_TOKEN = re.compile(r"[a-z0-9]+")


def tok(s: str) -> list[str]:
    return _TOKEN.findall(s.lower())


def gold_rank(ranking: list[int], gold_idx: int) -> int:
    """1-indexed rank of the gold document in a ranked list of corpus indices."""
    return ranking.index(gold_idx) + 1


def metrics_from_ranks(ranks: list[int]) -> dict:
    rr = [1.0 / r for r in ranks]
    return {
        "Hit@1": np.mean([r <= 1 for r in ranks]),
        "Hit@5": np.mean([r <= 5 for r in ranks]),
        "MRR@10": np.mean([(1.0 / r if r <= 10 else 0.0) for r in ranks]),
        "NDCG@10": np.mean([(1.0 / math.log2(r + 1) if r <= 10 else 0.0) for r in ranks]),
        "_rr": rr,
    }


def embed_corpus(corpus_texts: list[str], embedder: CohereEmbedder) -> np.ndarray:
    import hashlib

    CACHE.mkdir(parents=True, exist_ok=True)
    digest = hashlib.md5("\x00".join(corpus_texts).encode("utf-8")).hexdigest()[:10]
    cache_file = CACHE / f"corpus_emb_{len(corpus_texts)}_{digest}.npy"
    if cache_file.exists():
        return np.load(cache_file)
    print(f"Embedding {len(corpus_texts)} corpus documents (cached after first run)...")
    vecs = np.array(embedder.embed_documents(corpus_texts), dtype=np.float32)
    np.save(cache_file, vecs)
    return vecs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", "--n-queries", type=int, default=150)
    ap.add_argument("--rerank", action="store_true", help="also evaluate embeddings + Cohere rerank")
    ap.add_argument("--rerank-n", type=int, default=100)
    ap.add_argument("--rerank-candidates", type=int, default=20)
    args = ap.parse_args()

    queries, corpus = load(n_queries=args.n_queries)
    doc_ids = [d for d, _ in corpus]
    texts = [t for _, t in corpus]
    idx_of = {d: i for i, d in enumerate(doc_ids)}
    print(f"Corpus: {len(corpus)} documents   Queries: {len(queries)}\n")

    # --- Baseline: BM25 keyword retrieval ---
    bm25 = BM25Okapi([tok(t) for t in texts])

    # --- Ours: Cohere embeddings ---
    embedder = CohereEmbedder()
    corpus_vecs = embed_corpus(texts, embedder)
    corpus_norm = corpus_vecs / (np.linalg.norm(corpus_vecs, axis=1, keepdims=True) + 1e-9)

    q_texts = [q for q, _ in queries]
    q_vecs = np.array(embedder.embed_query_batch(q_texts) if hasattr(embedder, "embed_query_batch")
                      else [embedder.embed_query(q) for q in q_texts], dtype=np.float32)

    bm25_ranks, emb_ranks = [], []
    for i, (_, gold_doc) in enumerate(queries):
        gold = idx_of[gold_doc]

        bm_scores = bm25.get_scores(tok(q_texts[i]))
        bm25_ranks.append(gold_rank(list(np.argsort(-bm_scores)), gold))

        qn = q_vecs[i] / (np.linalg.norm(q_vecs[i]) + 1e-9)
        emb_scores = corpus_norm @ qn
        emb_ranks.append(gold_rank(list(np.argsort(-emb_scores)), gold))

    bm = metrics_from_ranks(bm25_ranks)
    em = metrics_from_ranks(emb_ranks)

    # --- Report ---
    cols = ["Hit@1", "Hit@5", "MRR@10", "NDCG@10"]
    print(f"{'Metric':<10}{'BM25 (keyword)':>16}{'Cohere (semantic)':>20}{'Rel. gain':>12}")
    print("-" * 58)
    for c in cols:
        gain = (em[c] - bm[c]) / bm[c] * 100 if bm[c] else float("nan")
        print(f"{c:<10}{bm[c]:>16.3f}{em[c]:>20.3f}{gain:>11.1f}%")

    stat, p = wilcoxon(em["_rr"], bm["_rr"], alternative="greater")
    print("-" * 58)
    print(f"\nWilcoxon signed-rank (reciprocal rank, semantic > keyword): p = {p:.2e}")
    verdict = "statistically significant" if p < 0.01 else "not significant at p<0.01"
    print(f"Result: {verdict}.")

    # --- Optional: add Cohere rerank on top of embeddings ---
    if args.rerank:
        from app.services.rerank import CohereReranker

        reranker = CohereReranker()
        rn = min(args.rerank_n, len(queries))
        c = args.rerank_candidates
        print(f"\nReranking top-{c} candidates for {rn} queries "
              f"(pauses to respect the trial rate limit)...")

        emb_only_ranks, rerank_ranks = [], []
        for i in range(rn):
            gold = idx_of[queries[i][1]]
            qn = q_vecs[i] / (np.linalg.norm(q_vecs[i]) + 1e-9)
            order = list(np.argsort(-(corpus_norm @ qn)))
            emb_only_ranks.append(order.index(gold) + 1)

            cand = order[:c]
            ranked = reranker.rerank(queries[i][0], [texts[j] for j in cand], top_n=c)
            new_order = [cand[r["index"]] for r in ranked]
            rest = [j for j in order if j not in set(cand)]
            full = new_order + rest
            rerank_ranks.append(full.index(gold) + 1)

        eo = metrics_from_ranks(emb_only_ranks)
        rr = metrics_from_ranks(rerank_ranks)
        print(f"\n{'Metric':<10}{'Embeddings':>14}{'Emb + Rerank':>16}{'Rel. gain':>12}")
        print("-" * 52)
        for col in cols:
            gain = (rr[col] - eo[col]) / eo[col] * 100 if eo[col] else float("nan")
            print(f"{col:<10}{eo[col]:>14.3f}{rr[col]:>16.3f}{gain:>11.1f}%")
        _, p2 = wilcoxon(rr["_rr"], eo["_rr"], alternative="greater")
        print("-" * 52)
        print(f"\nWilcoxon (rerank > embeddings): p = {p2:.2e}")
        print("Result:", "statistically significant." if p2 < 0.01 else "not significant at p<0.01.")


if __name__ == "__main__":
    main()

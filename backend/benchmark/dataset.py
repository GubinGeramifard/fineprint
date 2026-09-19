"""Load a labeled retrieval test set from SQuAD.

Each SQuAD question has a known source paragraph, which we treat as the single
relevant document. The corpus is every unique paragraph, so retrieval means
finding a question's source paragraph among ~2,000 candidates.
"""
import json
import random
import urllib.request
from pathlib import Path

SQUAD_URL = "https://rajpurkar.github.io/SQuAD-explorer/dataset/dev-v1.1.json"
CACHE = Path("benchmark/cache/squad_dev.json")


def _download() -> dict:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not CACHE.exists():
        print("Downloading SQuAD dev set...")
        urllib.request.urlretrieve(SQUAD_URL, CACHE)
    return json.loads(CACHE.read_text(encoding="utf-8"))


def load(n_queries: int = 150, corpus_size: int = 600, seed: int = 42):
    data = _download()
    all_contexts: list[str] = []
    seen: set[str] = set()
    pairs: list[tuple[str, str]] = []  # (context, question)

    for article in data["data"]:
        for para in article["paragraphs"]:
            ctx = para["context"]
            if ctx not in seen:
                seen.add(ctx)
                all_contexts.append(ctx)
            for qa_item in para["qas"]:
                pairs.append((ctx, qa_item["question"]))

    random.seed(seed)
    random.shuffle(pairs)
    sampled = pairs[:n_queries]

    gold, gold_seen = [], set()                       # every gold passage, deterministic order
    for c, _ in sampled:
        if c not in gold_seen:
            gold_seen.add(c)
            gold.append(c)
    others = [c for c in all_contexts if c not in gold_seen]
    random.shuffle(others)
    n_distract = max(0, corpus_size - len(gold))
    corpus_texts = gold + others[:n_distract]         # gold + distractors

    doc_id = {t: f"d{i}" for i, t in enumerate(corpus_texts)}
    corpus = [(doc_id[t], t) for t in corpus_texts]
    queries = [(q, doc_id[c]) for c, q in sampled]
    return queries, corpus

"""Local vector store (SQLite + in-memory cosine search).

Deliberately behind a small interface so it can be swapped for Postgres + pgvector
later without touching the rest of the app.
"""
import json
import sqlite3
from pathlib import Path

import numpy as np

from app.config import settings


class VectorStore:
    def __init__(self, path: str | None = None) -> None:
        self.path = path or settings.db_path
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chunks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id      TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                text        TEXT NOT NULL,
                embedding   TEXT NOT NULL
            )
            """
        )
        self.conn.commit()

    def add(self, doc_id: str, chunks: list[str], vectors: list[list[float]]) -> int:
        rows = [
            (doc_id, i, c, json.dumps(v))
            for i, (c, v) in enumerate(zip(chunks, vectors))
        ]
        self.conn.executemany(
            "INSERT INTO chunks (doc_id, chunk_index, text, embedding) VALUES (?, ?, ?, ?)",
            rows,
        )
        self.conn.commit()
        return len(rows)

    def _load(self):
        cur = self.conn.execute("SELECT id, doc_id, text, embedding FROM chunks")
        ids, docs, texts, embs = [], [], [], []
        for cid, doc_id, text, emb in cur:
            ids.append(cid)
            docs.append(doc_id)
            texts.append(text)
            embs.append(json.loads(emb))
        mat = np.array(embs, dtype=np.float32) if embs else np.zeros((0, settings.embed_dim))
        return ids, docs, texts, mat

    def search(self, query_vec: list[float], k: int = 5) -> list[dict]:
        ids, docs, texts, mat = self._load()
        if len(ids) == 0:
            return []
        q = np.array(query_vec, dtype=np.float32)
        q = q / (np.linalg.norm(q) + 1e-9)
        m = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
        scores = m @ q
        top = np.argsort(-scores)[:k]
        return [
            {"chunk_id": ids[i], "doc_id": docs[i], "text": texts[i], "score": float(scores[i])}
            for i in top
        ]

    def count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]

    def documents(self) -> list[dict]:
        cur = self.conn.execute(
            "SELECT doc_id, COUNT(*) FROM chunks GROUP BY doc_id ORDER BY doc_id"
        )
        return [{"doc_id": d, "chunks": c} for d, c in cur.fetchall()]

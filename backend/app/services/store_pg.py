"""Postgres + pgvector vector store, scoped per user.

Replaces the local SQLite store for the multi-user (Supabase) deployment.
"""
import uuid

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

from app.config import settings


def _connect() -> psycopg.Connection:
    conn = psycopg.connect(settings.database_url, connect_timeout=15)
    register_vector(conn)
    return conn


class PgStore:
    def add_document(
        self, user_id: str, filename: str, chunks: list[str], vectors: list[list[float]]
    ) -> str:
        uid = uuid.UUID(user_id)
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO documents (user_id, filename) VALUES (%s, %s) RETURNING id",
                (uid, filename),
            )
            doc_id = cur.fetchone()[0]
            rows = [
                (doc_id, uid, i, c, np.array(v, dtype=np.float32))
                for i, (c, v) in enumerate(zip(chunks, vectors))
            ]
            cur.executemany(
                "INSERT INTO chunks (document_id, user_id, chunk_index, text, embedding) "
                "VALUES (%s, %s, %s, %s, %s)",
                rows,
            )
            conn.commit()
        return str(doc_id)

    def list_documents(self, user_id: str) -> list[dict]:
        with _connect() as conn:
            rows = conn.execute(
                "SELECT d.id, d.filename, COUNT(c.id) "
                "FROM documents d LEFT JOIN chunks c ON c.document_id = d.id "
                "WHERE d.user_id = %s GROUP BY d.id, d.filename, d.created_at "
                "ORDER BY d.created_at DESC",
                (uuid.UUID(user_id),),
            ).fetchall()
        return [{"doc_id": str(r[0]), "filename": r[1], "chunks": r[2]} for r in rows]

    def get_doc_chunks(self, user_id: str, doc_id: str) -> list[str]:
        with _connect() as conn:
            rows = conn.execute(
                "SELECT text FROM chunks WHERE user_id = %s AND document_id = %s ORDER BY chunk_index",
                (uuid.UUID(user_id), uuid.UUID(doc_id)),
            ).fetchall()
        return [r[0] for r in rows]

    def search(
        self, user_id: str, query_vec: list[float], k: int = 20, document_id: str | None = None
    ) -> list[dict]:
        q = np.array(query_vec, dtype=np.float32)
        uid = uuid.UUID(user_id)
        with _connect() as conn:
            if document_id:
                rows = conn.execute(
                    "SELECT document_id, text, 1 - (embedding <=> %s) AS score FROM chunks "
                    "WHERE user_id = %s AND document_id = %s ORDER BY embedding <=> %s LIMIT %s",
                    (q, uid, uuid.UUID(document_id), q, k),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT document_id, text, 1 - (embedding <=> %s) AS score FROM chunks "
                    "WHERE user_id = %s ORDER BY embedding <=> %s LIMIT %s",
                    (q, uid, q, k),
                ).fetchall()
        return [{"doc_id": str(r[0]), "text": r[1], "score": float(r[2])} for r in rows]

    def delete_document(self, user_id: str, doc_id: str) -> None:
        with _connect() as conn:
            conn.execute(
                "DELETE FROM documents WHERE id = %s AND user_id = %s",
                (uuid.UUID(doc_id), uuid.UUID(user_id)),
            )
            conn.commit()

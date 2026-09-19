"""Cohere rerank: reorder retrieved passages by true relevance to the query."""
import time

import cohere

from app.config import settings


class CohereReranker:
    def __init__(self) -> None:
        self.client = cohere.ClientV2(settings.cohere_api_key)
        self.model = settings.rerank_model

    def rerank(self, query: str, documents: list[str], top_n: int = 5) -> list[dict]:
        if not documents:
            return []
        for attempt in range(8):
            try:
                resp = self.client.rerank(
                    model=self.model,
                    query=query,
                    documents=documents,
                    top_n=min(top_n, len(documents)),
                )
                return [{"index": r.index, "score": r.relevance_score} for r in resp.results]
            except Exception as e:
                if attempt == 7:
                    raise
                if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                    time.sleep(62)
                else:
                    time.sleep(3 * (attempt + 1))
        return []

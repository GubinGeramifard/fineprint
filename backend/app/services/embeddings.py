"""Cohere embeddings wrapper."""
import time

import cohere

from app.config import settings

_MAX_BATCH = 96  # Cohere embed limit per request


class CohereEmbedder:
    def __init__(self) -> None:
        self.client = cohere.ClientV2(settings.cohere_api_key)
        self.model = settings.embed_model

    def _embed(self, texts: list[str], input_type: str) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), _MAX_BATCH):
            batch = texts[i : i + _MAX_BATCH]
            for attempt in range(8):
                try:
                    resp = self.client.embed(
                        texts=batch,
                        model=self.model,
                        input_type=input_type,
                        embedding_types=["float"],
                    )
                    out.extend(resp.embeddings.float)
                    break
                except Exception as e:
                    if attempt == 7:
                        raise
                    # Cohere trial cap is 100k tokens/min; wait out the window on 429.
                    if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                        time.sleep(62)
                    else:
                        time.sleep(3 * (attempt + 1))
        return out

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts, "search_document")

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text], "search_query")[0]

    def embed_query_batch(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts, "search_query")

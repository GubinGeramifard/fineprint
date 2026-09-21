"""End-to-end RAG pipeline: retrieve -> rerank -> generate grounded answer."""
from app.services.embeddings import CohereEmbedder
from app.services.generate import CohereGenerator
from app.services.rerank import CohereReranker
from app.services.store_pg import PgStore


class RagPipeline:
    def __init__(self) -> None:
        self.embedder = CohereEmbedder()
        self.generator = CohereGenerator()
        self.reranker = CohereReranker()
        self.store = PgStore()

    def ask(
        self,
        user_id: str,
        question: str,
        k_retrieve: int = 20,
        k_rerank: int = 5,
        language: str | None = None,
        document_id: str | None = None,
    ) -> dict:
        qv = self.embedder.embed_query(question)
        hits = self.store.search(user_id, qv, k=k_retrieve, document_id=document_id)
        if not hits:
            return {
                "answer": "You have not uploaded any documents yet. Upload a contract to get started.",
                "sources": [],
                "citations": [],
            }

        ranked = self.reranker.rerank(question, [h["text"] for h in hits], top_n=k_rerank)
        passages = [{**hits[r["index"]], "rerank_score": r["score"]} for r in ranked]

        result = self.generator.answer(question, passages, language=language)
        result["sources"] = passages
        return result

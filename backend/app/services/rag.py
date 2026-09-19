"""End-to-end RAG pipeline: retrieve -> rerank -> generate grounded answer."""
from app.services.embeddings import CohereEmbedder
from app.services.generate import CohereGenerator
from app.services.rerank import CohereReranker
from app.services.store import VectorStore


class RagPipeline:
    def __init__(self) -> None:
        self.embedder = CohereEmbedder()
        self.store = VectorStore()
        self.reranker = CohereReranker()
        self.generator = CohereGenerator()

    def ask(self, question: str, k_retrieve: int = 20, k_rerank: int = 5) -> dict:
        qv = self.embedder.embed_query(question)
        hits = self.store.search(qv, k=k_retrieve)
        if not hits:
            return {"answer": "No documents have been indexed yet.", "sources": [], "citations": []}

        ranked = self.reranker.rerank(question, [h["text"] for h in hits], top_n=k_rerank)
        passages = [{**hits[r["index"]], "rerank_score": r["score"]} for r in ranked]

        result = self.generator.answer(question, passages)
        result["sources"] = passages
        return result

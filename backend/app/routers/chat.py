"""Chat / question-answering endpoint (RAG)."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.rag import RagPipeline

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    k: int = 5
    language: str | None = None


@router.post("")
def chat(req: ChatRequest):
    """Answer a question over the indexed documents, with citations and sources."""
    result = RagPipeline().ask(req.question, k_rerank=req.k, language=req.language)
    sources = [
        {"doc_id": s["doc_id"], "score": s.get("rerank_score"), "text": s["text"]}
        for s in result["sources"]
    ]
    return {
        "answer": result["answer"],
        "citations": result["citations"],
        "sources": sources,
    }

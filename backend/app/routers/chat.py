"""Chat / question-answering endpoint (RAG), per-user."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import get_current_user
from app.services.rag import RagPipeline

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    k: int = 5
    language: str | None = None
    document_id: str | None = None


@router.post("")
def chat(req: ChatRequest, user_id: str = Depends(get_current_user)):
    """Answer a question over this user's documents (optionally one), with citations."""
    result = RagPipeline().ask(
        user_id,
        req.question,
        k_rerank=req.k,
        language=req.language,
        document_id=req.document_id,
    )
    sources = [
        {"doc_id": s["doc_id"], "score": s.get("rerank_score"), "text": s["text"]}
        for s in result["sources"]
    ]
    return {"answer": result["answer"], "citations": result["citations"], "sources": sources}

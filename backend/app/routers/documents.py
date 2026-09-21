"""Document ingestion + library endpoints (per-user)."""
import os
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import get_current_user
from app.services.chunking import chunk_text
from app.services.embeddings import CohereEmbedder
from app.services.extract import extract_text
from app.services.risks import RiskAnalyzer
from app.services.store_pg import PgStore

router = APIRouter(prefix="/documents", tags=["documents"])
store = PgStore()


@router.post("")
async def upload_document(
    file: UploadFile = File(...), user_id: str = Depends(get_current_user)
):
    """Upload a PDF, Word, or text file: extract, chunk, embed, and store it for this user."""
    suffix = os.path.splitext(file.filename or "")[1] or ".txt"
    data = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        text = extract_text(tmp_path)
    finally:
        os.unlink(tmp_path)

    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="No extractable text found in the document.")

    vectors = CohereEmbedder().embed_documents(chunks)
    doc_id = store.add_document(user_id, file.filename or "document", chunks, vectors)
    return {"doc_id": doc_id, "filename": file.filename, "chunks": len(chunks)}


@router.get("")
def list_documents(user_id: str = Depends(get_current_user)):
    """List this user's documents (their library)."""
    return {"documents": store.list_documents(user_id)}


@router.delete("/{doc_id}")
def delete_document(doc_id: str, user_id: str = Depends(get_current_user)):
    """Delete one of this user's documents."""
    store.delete_document(user_id, doc_id)
    return {"ok": True}


@router.get("/{doc_id}/risks")
def document_risks(
    doc_id: str, language: str | None = None, user_id: str = Depends(get_current_user)
):
    """Flag risky or easy-to-miss clauses in one of this user's documents."""
    return {"flags": RiskAnalyzer().analyze(user_id, doc_id, language=language)}

"""Document ingestion endpoints."""
import os
import tempfile
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.chunking import chunk_text
from app.services.embeddings import CohereEmbedder
from app.services.extract import extract_text
from app.services.risks import RiskAnalyzer
from app.services.store import VectorStore

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("")
async def upload_document(file: UploadFile = File(...)):
    """Upload a PDF or text file: extract, chunk, embed, and store it."""
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
    doc_id = uuid.uuid4().hex[:12]
    n = VectorStore().add(doc_id, chunks, vectors)
    return {"doc_id": doc_id, "filename": file.filename, "chunks": n}


@router.get("")
def list_documents():
    """List ingested documents and their chunk counts."""
    return {"documents": VectorStore().documents()}


@router.get("/{doc_id}/risks")
def document_risks(doc_id: str):
    """Flag risky or easy-to-miss clauses in a document."""
    return {"flags": RiskAnalyzer().analyze(doc_id)}

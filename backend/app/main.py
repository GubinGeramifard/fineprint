"""FinePrint API — FastAPI entrypoint."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chat, documents

app = FastAPI(title="FinePrint API", version="0.1.0")

_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # allow any Vercel deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def seed_sample_document() -> None:
    """On a fresh (empty) database, index the bundled sample lease so the demo works."""
    from app.services.chunking import chunk_text
    from app.services.embeddings import CohereEmbedder
    from app.services.extract import extract_text
    from app.services.store import VectorStore

    try:
        store = VectorStore()
        if store.count() > 0:
            return
        sample = Path("samples/sample_lease.txt")
        if not sample.exists():
            return
        chunks = chunk_text(extract_text(str(sample)))
        store.add("lease", chunks, CohereEmbedder().embed_documents(chunks))
    except Exception:
        pass  # best-effort seeding; never block startup


@app.get("/health")
def health():
    """Liveness check."""
    return {"status": "ok", "service": "fineprint", "version": "0.1.0"}


app.include_router(documents.router)
app.include_router(chat.router)

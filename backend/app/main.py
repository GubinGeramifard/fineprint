"""DocuChat API — FastAPI entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, documents

app = FastAPI(title="DocuChat API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Liveness check."""
    return {"status": "ok", "service": "docuchat", "version": "0.1.0"}


app.include_router(documents.router)
app.include_router(chat.router)

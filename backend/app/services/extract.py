"""Extract plain text from a document (PDF or text)."""
from pathlib import Path
from pypdf import PdfReader


def extract_text(path: str) -> str:
    p = Path(path)
    if p.suffix.lower() == ".pdf":
        reader = PdfReader(str(p))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    return p.read_text(encoding="utf-8", errors="ignore")

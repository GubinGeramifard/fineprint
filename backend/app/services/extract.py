"""Extract plain text from a document (PDF or text), in any language."""
from pathlib import Path

from pypdf import PdfReader


def _decode(data: bytes) -> str:
    # Try common encodings so non-English text files decode cleanly.
    for enc in ("utf-8-sig", "utf-8", "utf-16", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def extract_text(path: str) -> str:
    p = Path(path)
    ext = p.suffix.lower()
    if ext == ".pdf":
        reader = PdfReader(str(p))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    if ext == ".docx":
        from docx import Document

        return "\n".join(par.text for par in Document(str(p)).paragraphs)
    return _decode(p.read_bytes())

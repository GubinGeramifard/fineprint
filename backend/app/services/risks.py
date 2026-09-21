"""Proactively flag risky or easy-to-miss clauses in a document."""
import json
import time

import cohere

from app.config import settings
from app.services.store_pg import PgStore

RISK_PROMPT = (
    "You are SignD, reviewing a contract for an everyday person who is not a lawyer. "
    "From the document text, identify the specific clauses they should watch out for: "
    "penalties, extra fees, automatic renewal, deposits they could lose, liability or waivers, "
    "short deadlines, or anything costly or easy to miss. "
    'Respond ONLY with a JSON object of the form {"flags": [{"title": "...", "detail": "..."}]}. '
    "'title' is a short label of a few words. 'detail' is one plain-language sentence on why it "
    "matters. Include only items actually present in the document, at most 6, most important "
    'first. If nothing notable stands out, return {"flags": []}.'
)


class RiskAnalyzer:
    def __init__(self) -> None:
        self.client = cohere.ClientV2(settings.cohere_api_key)
        self.model = settings.chat_model

    def analyze(self, user_id: str, doc_id: str, language: str | None = None) -> list[dict]:
        chunks = PgStore().get_doc_chunks(user_id, doc_id)
        if not chunks:
            return []
        text = "\n\n".join(chunks)[:8000]

        if language and language.lower() != "auto":
            lang_line = f" Write the titles and details in {language}."
        else:
            lang_line = " Write the titles and details in the same language as the document."

        for attempt in range(6):
            try:
                resp = self.client.chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": RISK_PROMPT + lang_line},
                        {"role": "user", "content": text},
                    ],
                    response_format={"type": "json_object"},
                )
                break
            except Exception as e:
                if attempt == 5:
                    raise
                if "TooManyRequests" in type(e).__name__ or "429" in str(e):
                    time.sleep(62)
                else:
                    time.sleep(3 * (attempt + 1))

        raw = "".join(
            b.text for b in resp.message.content if getattr(b, "type", "") == "text"
        )
        try:
            flags = json.loads(raw).get("flags", [])
        except Exception:
            return []

        out = []
        for f in flags:
            if isinstance(f, dict) and f.get("title"):
                out.append(
                    {"title": str(f["title"])[:80], "detail": str(f.get("detail", ""))[:220]}
                )
        return out[:6]

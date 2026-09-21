"""Grounded answer generation with Cohere Chat (RAG mode, returns citations)."""
import cohere

from app.config import settings

SYSTEM_PROMPT = (
    "You are SignD, an assistant that helps everyday people understand legal and "
    "contractual documents such as leases, contracts, job offers, and terms of service. "
    "Answer only from the provided document excerpts. Explain in plain, simple language a "
    "non-lawyer can understand, and keep answers concise. Ground every answer in the specific "
    "clause. If a term is risky or easy to miss (automatic renewal, penalties, extra fees, "
    "liability, waivers, short deadlines), point it out clearly. If the document does not cover "
    "the question, say so plainly instead of guessing. You explain what the document says; you "
    "do not give formal legal advice."
)


class CohereGenerator:
    def __init__(self) -> None:
        self.client = cohere.ClientV2(settings.cohere_api_key)
        self.model = settings.chat_model

    def answer(self, question: str, passages: list[dict], language: str | None = None) -> dict:
        documents = [
            {"id": str(i), "data": {"text": p["text"]}}
            for i, p in enumerate(passages)
        ]
        if language and language.lower() != "auto":
            lang_line = (
                f" Always write your answer in {language}, regardless of the language of the "
                "question or the document."
            )
        else:
            lang_line = " Always answer in the same language as the user's question."
        resp = self.client.chat(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT + lang_line},
                {"role": "user", "content": question},
            ],
            documents=documents,
        )

        text = "".join(
            block.text for block in resp.message.content if getattr(block, "type", "") == "text"
        )

        citations = []
        for c in getattr(resp.message, "citations", None) or []:
            sources = []
            for s in getattr(c, "sources", None) or []:
                sources.append(getattr(s, "id", None) or getattr(s, "document", {}).get("id"))
            citations.append(
                {"start": c.start, "end": c.end, "text": c.text, "sources": sources}
            )

        return {"answer": text, "citations": citations}

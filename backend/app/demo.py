"""CLI to exercise the ingestion + retrieval pipeline end to end.

Usage (from backend/):
    python -m app.demo ingest data/sample.txt --doc-id handbook
    python -m app.demo query "how many vacation days do employees get?"
"""
import argparse

from app.services.chunking import chunk_text
from app.services.embeddings import CohereEmbedder
from app.services.extract import extract_text
from app.services.store import VectorStore


def cmd_ingest(path: str, doc_id: str) -> None:
    text = extract_text(path)
    chunks = chunk_text(text)
    if not chunks:
        print("No text extracted.")
        return
    vectors = CohereEmbedder().embed_documents(chunks)
    n = VectorStore().add(doc_id, chunks, vectors)
    print(f"Ingested {n} chunks from {path} (doc_id={doc_id}).")


def cmd_query(question: str, k: int) -> None:
    qv = CohereEmbedder().embed_query(question)
    results = VectorStore().search(qv, k=k)
    if not results:
        print("Nothing indexed yet.")
        return
    print(f'Query: "{question}"\n')
    for rank, r in enumerate(results, 1):
        snippet = r["text"][:280].strip()
        print(f"#{rank}  score={r['score']:.3f}  [{r['doc_id']}]\n{snippet}\n")


def cmd_ask(question: str, k: int) -> None:
    from app.services.rag import RagPipeline

    res = RagPipeline().ask(question, k_rerank=k)
    print(f"Q: {question}\n")
    print("Answer:\n" + res["answer"] + "\n")
    print("Sources used:")
    for i, s in enumerate(res["sources"], 1):
        print(f"  [{i}] rerank={s.get('rerank_score', 0):.3f}  {s['text'][:110].strip()}...")
    if res["citations"]:
        print("\nCitations:")
        for c in res["citations"]:
            print(f'  "{c["text"]}"  ->  source(s) {c["sources"]}')


def main() -> None:
    ap = argparse.ArgumentParser(description="DocuChat pipeline demo")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_ing = sub.add_parser("ingest")
    p_ing.add_argument("path")
    p_ing.add_argument("--doc-id", default="doc")

    p_q = sub.add_parser("query")
    p_q.add_argument("question")
    p_q.add_argument("-k", type=int, default=3)

    p_a = sub.add_parser("ask")
    p_a.add_argument("question")
    p_a.add_argument("-k", type=int, default=5)

    args = ap.parse_args()
    if args.cmd == "ingest":
        cmd_ingest(args.path, args.doc_id)
    elif args.cmd == "query":
        cmd_query(args.question, args.k)
    elif args.cmd == "ask":
        cmd_ask(args.question, args.k)


if __name__ == "__main__":
    main()

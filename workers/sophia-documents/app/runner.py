from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .classifier import classify
from .chunking import chunk_blocks
from .config import get_settings
from .extractors.docx import extract_docx
from .extractors.image import extract_image
from .extractors.pdf import extract_pdf
from .extractors.text import extract_text
from .supabase_client import get_client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _single(response: Any) -> dict[str, Any] | None:
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data if isinstance(data, dict) else None


def _extract(buffer: bytes, filename: str, mime_type: str):
    settings = get_settings()
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        return extract_pdf(buffer, settings.ocr_langs, settings.max_pages)
    if mime_type in ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword") or filename.lower().endswith(".docx"):
        return extract_docx(buffer)
    if mime_type.startswith("image/") or filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        return extract_image(buffer, settings.ocr_langs)
    return extract_text(buffer, filename)


def _load_source(source_type: str, source_id: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    client = get_client()
    if source_type == "inbox":
        response = client.table("sophia_inbox_items").select("*").eq("id", source_id).limit(1).execute()
        item = _single(response)
        if not item:
            raise ValueError("Item da caixa de entrada nao encontrado.")
        document = None
        if item.get("document_id"):
            document = _single(client.table("documents").select("*").eq("id", item["document_id"]).limit(1).execute())
        return item, document
    document = _single(client.table("documents").select("*").eq("id", source_id).limit(1).execute())
    if not document:
        raise ValueError("Documento nao encontrado.")
    return document, document


def _ensure_document(item: dict[str, Any], document: dict[str, Any] | None) -> dict[str, Any]:
    if document:
        return document
    client = get_client()
    payload = {
        "organization_id": item["organization_id"],
        "uploaded_by": item.get("user_id"),
        "original_name": item["original_name"],
        "title": item["original_name"],
        "storage_provider": "supabase_storage",
        "storage_bucket": item.get("storage_bucket") or get_settings().storage_bucket,
        "storage_path": item["storage_path"],
        "size_bytes": item.get("size_bytes") or 0,
        "mime_type": item.get("mime_type"),
        "upload_status": "enviado",
        "processing_status": "processando",
    }
    created = _single(client.table("documents").insert(payload).execute())
    if not created:
        raise RuntimeError("Nao foi possivel criar o registro documental.")
    client.table("sophia_inbox_items").update({"document_id": created["id"]}).eq("id", item["id"]).execute()
    return created


def _set_job(job_id: str | None, values: dict[str, Any]) -> None:
    if job_id:
        get_client().table("document_processing_jobs").update({**values, "updated_at": _now()}).eq("id", job_id).execute()


def _set_ingestion_job(source_type: str, source_id: str, values: dict[str, Any]) -> None:
    if source_type != "inbox":
        return
    try:
        get_client().table("sophia_document_ingestion_jobs").update({**values, "updated_at": _now()}).eq("inbox_item_id", source_id).in_("status", ["pending", "processing"]).execute()
    except Exception as exc:
        print(f"[sophia-documents] fila cognitiva indisponivel: {exc}", flush=True)


def _local_summary(text: str, filename: str) -> str:
    cleaned = " ".join(text.split())
    if not cleaned:
        return f"O documento {filename} nao trouxe texto legivel. Verifique o OCR ou a qualidade do arquivo."
    sentences = [part.strip() for part in cleaned.replace("!", ".").replace("?", ".").split(".") if part.strip()]
    excerpt = ". ".join(sentences[:4])
    return f"Documento {filename}: {excerpt[:1200]}" + ("..." if len(excerpt) > 1200 else "")


def process_source(source_type: str, source_id: str) -> dict[str, Any]:
    client = get_client()
    print(f"[sophia-documents] iniciando processamento: source={source_type} id={source_id}", flush=True)
    source, document = _load_source(source_type, source_id)
    document = _ensure_document(source, document)
    document_id = document["id"]
    job = _single(client.table("document_processing_jobs").insert({
        "document_id": document_id,
        "inbox_item_id": source["id"] if source_type == "inbox" else None,
        "organization_id": document["organization_id"],
        "storage_bucket": document.get("storage_bucket") or get_settings().storage_bucket,
        "storage_path": document["storage_path"],
        "file_name": document["original_name"],
        "mime_type": document.get("mime_type"),
        "status": "processing",
        "progress": 10,
        "created_by": source.get("user_id") if source_type == "inbox" else document.get("uploaded_by"),
        "started_at": _now(),
    }).execute())
    job_id = job.get("id") if job else None
    try:
        _set_ingestion_job(source_type, source["id"], {"status": "processing", "progress": 10})
        client.table("documents").update({"processing_status": "processando", "processing_error": None}).eq("id", document_id).execute()
        if source_type == "inbox":
            client.table("sophia_inbox_items").update({"status": "processing", "error_message": None}).eq("id", source["id"]).execute()
        bucket = document.get("storage_bucket") or get_settings().storage_bucket
        buffer = client.storage.from_(bucket).download(document["storage_path"])
        result = _extract(buffer, document["original_name"], document.get("mime_type") or "")
        if result.status == "erro":
            raise RuntimeError("; ".join(result.warnings) or "Falha na extracao.")
        chunks = chunk_blocks(result.blocks)
        kind, confidence = classify(document["original_name"], result.text)
        client.table("document_extracted_pages").delete().eq("document_id", document_id).execute()
        if result.pages:
            client.table("document_extracted_pages").insert([
                {
                    "organization_id": document["organization_id"],
                    "document_id": document_id,
                    "page_number": page.page_number,
                    "extraction_method": page.method,
                    "text": page.text,
                    "confidence": page.confidence,
                    "metadata": page.metadata,
                }
                for page in result.pages
            ]).execute()
        client.table("document_chunks").delete().eq("document_id", document_id).execute()
        if chunks:
            client.table("document_chunks").insert([
                {
                    "document_id": document_id,
                    "organization_id": document["organization_id"],
                    "page": chunk["page_start"],
                    "page_start": chunk["page_start"],
                    "page_end": chunk["page_end"],
                    "chunk_index": chunk["order_index"],
                    "order_index": chunk["order_index"],
                    "text": chunk["text"],
                    "content": chunk["content"],
                    "content_hash": chunk["content_hash"],
                    "token_estimate": chunk["token_estimate"],
                    "extraction_method": result.method,
                    "source": "sophia_document_worker",
                    "metadata": {"warnings": result.warnings},
                }
                for chunk in chunks
            ]).execute()
        client.table("document_ai_summaries").insert({
            "organization_id": document["organization_id"],
            "document_id": document_id,
            "provider": "local_extractive",
            "summary": _local_summary(result.text, document["original_name"]),
            "document_type": kind,
            "entities": [],
            "risks": [],
            "next_actions": [],
            "confidence": confidence,
            "needs_confirmation": True,
        }).execute()
        needs_ocr = not result.text.strip() and (
            document.get("mime_type", "").startswith("image/")
            or document.get("mime_type") == "application/pdf"
            or document["original_name"].lower().endswith(".pdf")
        )
        status = "precisa_ocr" if needs_ocr else "concluido"
        client.table("documents").update({
            "processing_status": status,
            "processing_error": None,
            "extracted_text": result.text,
            "pages": len(result.pages) or None,
            "document_type": kind,
            "updated_at": _now(),
        }).eq("id", document_id).execute()
        if source_type == "inbox":
            client.table("sophia_inbox_items").update({
                "status": "processed",
                "classification": {"documentType": kind, "confidence": confidence, "extractionMethod": result.method},
                "confidence": confidence,
                "error_message": None,
                "updated_at": _now(),
            }).eq("id", source["id"]).execute()
        _set_job(job_id, {"status": "done", "progress": 100, "pages_total": len(result.pages), "pages_ocr": result.pages_ocr, "chunks_total": len(chunks), "finished_at": _now()})
        _set_ingestion_job(source_type, source["id"], {"status": "completed", "progress": 100, "extractor": result.method, "ocr_used": result.pages_ocr > 0, "completed_at": _now(), "metadata": {"document_type": kind, "chunks": len(chunks)}})
        print(f"[sophia-documents] concluido: document_id={document_id} chunks={len(chunks)} pages_ocr={result.pages_ocr}", flush=True)
        return {"document_id": document_id, "status": "concluido", "document_type": kind, "pages": len(result.pages), "pages_ocr": result.pages_ocr, "chunks": len(chunks), "warnings": result.warnings}
    except Exception as exc:
        message = str(exc)
        client.table("documents").update({"processing_status": "erro", "processing_error": message, "updated_at": _now()}).eq("id", document_id).execute()
        if source_type == "inbox":
            client.table("sophia_inbox_items").update({"status": "failed", "error_message": message, "updated_at": _now()}).eq("id", source["id"]).execute()
        _set_job(job_id, {"status": "error", "progress": 100, "error_message": message, "finished_at": _now()})
        _set_ingestion_job(source_type, source["id"], {"status": "failed", "progress": 100, "error_message": message})
        print(f"[sophia-documents] erro: document_id={document_id} error={message}", flush=True)
        raise

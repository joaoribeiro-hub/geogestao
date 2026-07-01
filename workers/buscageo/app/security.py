from __future__ import annotations

from fastapi import Header, HTTPException

from .settings import BUSCAGEO_WORKER_SECRET


def require_worker_secret(authorization: str | None = Header(default=None)) -> None:
    received = (authorization or "").replace("Bearer ", "", 1).strip()
    if not BUSCAGEO_WORKER_SECRET or received != BUSCAGEO_WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Worker nao autorizado.")

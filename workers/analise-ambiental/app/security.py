from __future__ import annotations

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_worker_secret(authorization: str | None = Header(default=None)) -> None:
    configured_secret = get_settings().worker_secret
    if not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ANALISE_AMBIENTAL_WORKER_SECRET nao configurado no worker.",
        )
    expected = f"Bearer {configured_secret}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Worker secret invalido.")

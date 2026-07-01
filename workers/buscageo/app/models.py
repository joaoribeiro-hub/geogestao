from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class WorkerPayload(BaseModel):
    job_id: str
    organization_id: str
    callback_url: str | None = None
    input_storage_path: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    bbox: list[float] | None = None
    geometry: dict[str, Any] | None = None
    scenes: list[dict[str, Any]] = Field(default_factory=list)
    selected_scene_ids: list[str] = Field(default_factory=list)


class AcceptedResponse(BaseModel):
    ok: bool = True
    status: str = "accepted"
    message: str

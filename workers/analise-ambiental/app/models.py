from __future__ import annotations

from pydantic import BaseModel, Field


class AcceptedResponse(BaseModel):
    message: str


class PollResponse(BaseModel):
    accepted: int
    job_ids: list[str] = Field(default_factory=list)

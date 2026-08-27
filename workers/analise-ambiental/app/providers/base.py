from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.processing.aoi import AoiResult


@dataclass
class ProviderResult:
    source: str
    outputs: dict[str, Path] = field(default_factory=dict)
    summary: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


class EnvironmentalProvider:
    source = "provider"

    def analyze(self, aoi: AoiResult, output_dir: Path) -> ProviderResult:
        raise NotImplementedError

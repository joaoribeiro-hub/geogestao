from __future__ import annotations

from pathlib import Path

from app.processing.aoi import AoiResult

from .base import EnvironmentalProvider, ProviderResult


class GoogleEarthEngineMapBiomasProvider(EnvironmentalProvider):
    source = "gee_mapbiomas"

    def __init__(self, *, enabled: bool) -> None:
        self.enabled = enabled

    def analyze(self, aoi: AoiResult, output_dir: Path) -> ProviderResult:
        if not self.enabled:
            return ProviderResult(
                source=self.source,
                warnings=["Google Earth Engine desativado por configuracao. Nenhum dado GEE foi consultado."],
            )
        return ProviderResult(
            source=self.source,
            warnings=["Provider GEE ainda esta preparado, mas sem execucao real nesta fase."],
        )

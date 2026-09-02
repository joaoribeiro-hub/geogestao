from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from app.config import Settings
from app.processing.aoi import AoiResult
from app.processing.layers import EnvironmentalLayer
from app.providers.current_image_provider import CurrentImageProvider
from app.providers.current_image_provider import DynamicWorldProvider


class VegetationModelProvider(ABC):
    @abstractmethod
    def is_available(self) -> bool: ...

    @abstractmethod
    def predict(self, aoi: AoiResult, raster_path: str | Path) -> tuple[list[EnvironmentalLayer], list[str]]: ...

    @abstractmethod
    def metadata(self) -> dict[str, Any]: ...


class RuleBasedNdviProvider(VegetationModelProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.provider = CurrentImageProvider(settings=settings)

    def is_available(self) -> bool:
        return self.provider.is_configured()

    def predict(self, aoi: AoiResult, raster_path: str | Path) -> tuple[list[EnvironmentalLayer], list[str]]:
        return self.provider.analyze(aoi, raster_path)

    def metadata(self) -> dict[str, Any]:
        return {"provider": "rule_based_ndvi", "enabled": self.is_available(), "requires_gpu": False}


def vegetation_model_catalog(settings: Settings) -> list[dict[str, Any]]:
    return [
        RuleBasedNdviProvider(settings).metadata(),
        {
            "provider": "dynamic_world",
            "enabled": DynamicWorldProvider(settings=settings, tmp_dir=settings.tmp_dir / "dynamic-world").is_configured(),
            "requires_gpu": False,
            "status": "prepared",
        },
        {"provider": "samgeo_experimental", "enabled": False, "requires_gpu": True, "status": "disabled"},
        {
            "provider": "custom_trained_model",
            "enabled": bool(settings.custom_vegetation_model_enabled and settings.custom_vegetation_model_path),
            "version": settings.custom_vegetation_model_version or None,
            "status": "prepared",
        },
        {"provider": "rastervision_future", "enabled": False, "requires_gpu": True, "status": "future"},
    ]

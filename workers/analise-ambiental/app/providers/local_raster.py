from __future__ import annotations

from pathlib import Path
from typing import Any

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from app.processing.aoi import AoiResult
from app.processing.exporters import write_geojson

from .base import EnvironmentalProvider, ProviderResult


class LocalRasterMapBiomasProvider(EnvironmentalProvider):
    source = "dev_fixture"

    def __init__(self, *, enabled: bool, data_dir: Path) -> None:
        self.enabled = enabled
        self.data_dir = data_dir

    def analyze(self, aoi: AoiResult, output_dir: Path) -> ProviderResult:
        if not self.enabled:
            return ProviderResult(source=self.source, warnings=["Fixture local desativada por configuracao."])

        raster_path = self.data_dir / "mapbiomas_fixture.tif"
        if not raster_path.exists():
            return ProviderResult(
                source=self.source,
                warnings=[
                    "Fixture MapBiomas local nao encontrada. Rode `python -m app.tools.create_dev_fixture` no worker."
                ],
            )

        try:
            return self._analyze_raster(aoi, output_dir, raster_path)
        except Exception as exc:
            return ProviderResult(source=self.source, warnings=[f"Falha ao ler fixture local: {exc}"])

    def _analyze_raster(self, aoi: AoiResult, output_dir: Path, raster_path: Path) -> ProviderResult:
        import rasterio
        from rasterio.features import shapes
        from rasterio.mask import mask

        vegetation_values = {3, 4, 5, 49}
        water_values = {26, 33}
        with rasterio.open(raster_path) as dataset:
            clipped, transform = mask(dataset, [aoi.geometry_geojson], crop=True, filled=True, nodata=0)
            band = clipped[0]
            vegetation_features = _features_for_values(band, transform, vegetation_values)
            water_features = _features_for_values(band, transform, water_values)

        outputs: dict[str, Path] = {}
        summary: dict[str, Any] = {"source": self.source}
        if vegetation_features:
            vegetation_geometry = unary_union([shape(feature["geometry"]) for feature in vegetation_features])
            outputs["vegetacao_geojson"] = write_geojson(
                output_dir / "vegetacao.geojson",
                mapping(vegetation_geometry),
                {"source": self.source, "layer": "vegetacao"},
            )
            summary["vegetation_feature_count"] = len(vegetation_features)
        else:
            summary["vegetation_feature_count"] = 0

        if water_features:
            water_geometry = unary_union([shape(feature["geometry"]) for feature in water_features])
            outputs["agua_geojson"] = write_geojson(
                output_dir / "agua.geojson",
                mapping(water_geometry),
                {"source": self.source, "layer": "agua"},
            )
            summary["water_feature_count"] = len(water_features)
        else:
            summary["water_feature_count"] = 0

        return ProviderResult(source=self.source, outputs=outputs, summary=summary)


def _features_for_values(band: Any, transform: Any, values: set[int]) -> list[dict[str, Any]]:
    mask_values = band != 0
    features: list[dict[str, Any]] = []
    for geometry, value in shapes(band, mask=mask_values, transform=transform):
        if int(value) in values:
            features.append({"type": "Feature", "properties": {"class": int(value)}, "geometry": geometry})
    return features

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pyproj import Transformer
from shapely.affinity import scale, translate
from shapely.geometry import LineString, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform

from .aoi import AoiResult


@dataclass(frozen=True)
class EnvironmentalLayer:
    key: str
    name: str
    geometry: BaseGeometry
    provider: str
    confidence: str
    official_data: bool
    warning: str | None = None
    area_ha: float | None = None
    length_m: float | None = None
    metadata: dict[str, Any] | None = None


def generate_dev_fixture_layers(aoi: AoiResult, requested_layers: list[str]) -> list[EnvironmentalLayer]:
    normalized_requested = {item.lower() for item in requested_layers}
    include_all = not normalized_requested
    layers: list[EnvironmentalLayer] = []

    if include_all or normalized_requested.intersection({"vegetacao", "vegetacao_existente"}):
        vegetation = _inner_box(aoi.geometry, 0.58, 0.58, -0.08, 0.08)
        layers.append(
            _layer(
                key="vegetacao_existente",
                name="Vegetação existente",
                geometry=vegetation,
                aoi=aoi,
                confidence="teste",
            )
        )

    if include_all or normalized_requested.intersection({"agua", "agua_represa"}):
        water = _inner_box(aoi.geometry, 0.28, 0.24, 0.22, -0.18)
        layers.append(
            _layer(
                key="agua_represa",
                name="Água/represa",
                geometry=water,
                aoi=aoi,
                confidence="teste",
            )
        )

    if include_all or normalized_requested.intersection({"drenagem", "drenagem_corrego"}):
        drainage = _drainage_line(aoi.geometry)
        layers.append(
            _layer(
                key="drenagem_corrego",
                name="Drenagem/córrego",
                geometry=drainage,
                aoi=aoi,
                confidence="teste",
            )
        )

    return [layer for layer in layers if not layer.geometry.is_empty]


def layer_to_report(layer: EnvironmentalLayer) -> dict[str, Any]:
    return {
        "layer_key": layer.key,
        "layer_name": layer.name,
        "provider": layer.provider,
        "official_data": layer.official_data,
        "confidence": layer.confidence,
        "area_ha": layer.area_ha,
        "length_m": layer.length_m,
        "warning": layer.warning,
        "metadata": layer.metadata or {},
    }


def _layer(key: str, name: str, geometry: BaseGeometry, aoi: AoiResult, confidence: str) -> EnvironmentalLayer:
    measured = _measure_geometry(geometry, aoi.metric_crs)
    return EnvironmentalLayer(
        key=key,
        name=name,
        geometry=geometry,
        provider="dev_fixture",
        confidence=confidence,
        official_data=False,
        warning="Camadas geradas apenas para teste do fluxo. Não usar como dado oficial.",
        area_ha=measured["area_ha"],
        length_m=measured["length_m"],
        metadata={"simulated": True, "color": "#7c3aed"},
    )


def _inner_box(geometry: BaseGeometry, width_factor: float, height_factor: float, x_offset: float, y_offset: float) -> BaseGeometry:
    min_x, min_y, max_x, max_y = geometry.bounds
    base = box(min_x, min_y, max_x, max_y)
    scaled = scale(base, xfact=width_factor, yfact=height_factor, origin="center")
    moved = translate(scaled, xoff=(max_x - min_x) * x_offset, yoff=(max_y - min_y) * y_offset)
    return moved.intersection(geometry).buffer(0)


def _drainage_line(geometry: BaseGeometry) -> BaseGeometry:
    min_x, min_y, max_x, max_y = geometry.bounds
    line = LineString(
        [
            (min_x + (max_x - min_x) * 0.1, min_y + (max_y - min_y) * 0.2),
            (min_x + (max_x - min_x) * 0.45, min_y + (max_y - min_y) * 0.55),
            (min_x + (max_x - min_x) * 0.9, min_y + (max_y - min_y) * 0.75),
        ]
    )
    return line.intersection(geometry)


def _measure_geometry(geometry: BaseGeometry, metric_crs: str) -> dict[str, float | None]:
    transformer = Transformer.from_crs("EPSG:4326", metric_crs, always_xy=True)
    metric_geometry = transform(transformer.transform, geometry)
    area_ha = round(float(metric_geometry.area) / 10_000, 4) if metric_geometry.area > 0 else None
    length_m = round(float(metric_geometry.length), 2) if metric_geometry.length > 0 else None
    return {"area_ha": area_ha, "length_m": length_m}

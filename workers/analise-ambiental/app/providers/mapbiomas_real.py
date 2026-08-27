from __future__ import annotations

from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

from app.mapbiomas_classes import MAPBIOMAS_GROUPS, MINIMUM_REAL_LAYER_KEYS, MapBiomasGroup
from app.processing.aoi import AoiResult
from app.processing.layers import EnvironmentalLayer


class MapBiomasRealProvider:
    provider_key = "mapbiomas_real"

    def __init__(self, *, raster_source: str, year: int, collection: str, provider_key: str | None = None) -> None:
        self.raster_source = raster_source
        self.year = year
        self.collection = collection
        self.provider_key = provider_key or self.provider_key

    def analyze(self, aoi: AoiResult, requested_layers: list[str]) -> tuple[list[EnvironmentalLayer], list[str]]:
        if not self.raster_source:
            return [], ["Provider mapbiomas_real sem GeoTIFF configurado. Informe raster no job ou MAPBIOMAS_RASTER_LOCAL_PATH/MAPBIOMAS_RASTER_URL."]

        import numpy as np
        import rasterio
        from rasterio.features import shapes
        from rasterio.mask import mask

        selected_groups = _selected_groups(requested_layers)
        warnings: list[str] = []
        layers: list[EnvironmentalLayer] = []

        with rasterio.open(self.raster_source) as dataset:
            if dataset.crs is None:
                raise ValueError("Raster MapBiomas sem CRS. Informe um GeoTIFF georreferenciado.")

            raster_crs = dataset.crs.to_string()
            aoi_in_raster_crs = _transform_geometry(aoi.geometry, "EPSG:4326", raster_crs)
            nodata = dataset.nodata if dataset.nodata is not None else 0
            clipped, clipped_transform = mask(
                dataset,
                [aoi_in_raster_crs.__geo_interface__],
                crop=True,
                filled=True,
                nodata=nodata,
            )
            band = clipped[0]
            valid_mask = band != nodata
            if not bool(valid_mask.any()):
                return [], ["GeoTIFF MapBiomas não possui pixels válidos dentro da propriedade."]

            for group in selected_groups:
                group_mask = np.isin(band, list(group.codes)) & valid_mask
                if not bool(group_mask.any()):
                    continue

                binary = group_mask.astype("uint8")
                geometries: list[BaseGeometry] = []
                for geometry, value in shapes(binary, mask=group_mask, transform=clipped_transform):
                    if int(value) != 1:
                        continue
                    geom = shape(geometry)
                    if not geom.is_valid:
                        geom = geom.buffer(0)
                    if not geom.is_empty:
                        geometries.append(geom)

                if not geometries:
                    continue

                merged = unary_union(geometries)
                merged_wgs84 = _transform_geometry(merged, raster_crs, "EPSG:4326").intersection(aoi.geometry).buffer(0)
                if merged_wgs84.is_empty:
                    continue

                metrics = _measure_geometry(merged_wgs84, aoi.metric_crs)
                percent = round((metrics["area_ha"] or 0) / aoi.area_ha * 100, 2) if aoi.area_ha else None
                warning = _rectangular_warning(group, merged_wgs84, len(geometries))
                if warning:
                    warnings.append(warning)

                layers.append(
                    EnvironmentalLayer(
                        key=group.key,
                        name=group.name,
                        geometry=merged_wgs84,
                        provider=self.provider_key,
                        confidence="alta",
                        official_data=True,
                        warning=warning,
                        area_ha=metrics["area_ha"],
                        length_m=metrics["length_m"],
                        metadata={
                            "mapbiomas_year": self.year,
                            "mapbiomas_collection": self.collection,
                            "class_codes": sorted(group.codes),
                            "pixel_count": int(group_mask.sum()),
                            "feature_count": len(geometries),
                            "percent": percent,
                            "color": group.color,
                        },
                    )
                )

        return layers, warnings


def _selected_groups(requested_layers: list[str]) -> list[MapBiomasGroup]:
    normalized = {item.strip().lower() for item in requested_layers if item.strip()}
    aliases = {
        "vegetacao": "vegetacao_nativa",
        "vegetacao_existente": "vegetacao_nativa",
        "agua_represa": "agua",
    }
    if not normalized:
        keys = MINIMUM_REAL_LAYER_KEYS
    else:
        keys = [aliases.get(item, item) for item in normalized]
    return [MAPBIOMAS_GROUPS[key] for key in keys if key in MAPBIOMAS_GROUPS]


def _transform_geometry(geometry: BaseGeometry, source_crs: str, target_crs: str) -> BaseGeometry:
    if source_crs == target_crs:
        return geometry
    transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
    return transform(transformer.transform, geometry)


def _measure_geometry(geometry: BaseGeometry, metric_crs: str) -> dict[str, float | None]:
    metric_geometry = _transform_geometry(geometry, "EPSG:4326", metric_crs)
    area_ha = round(float(metric_geometry.area) / 10_000, 4) if metric_geometry.area > 0 else None
    length_m = round(float(metric_geometry.length), 2) if metric_geometry.length > 0 else None
    return {"area_ha": area_ha, "length_m": length_m}


def _rectangular_warning(group: MapBiomasGroup, geometry: BaseGeometry, feature_count: int) -> str | None:
    if feature_count > 1 or geometry.area <= 0:
        return None
    envelope = geometry.envelope
    difference_ratio = envelope.symmetric_difference(geometry).area / max(envelope.area, geometry.area)
    if difference_ratio < 0.02:
        return f"A camada {group.name} ficou quase retangular; confira se o raster de entrada é um recorte real e não uma máscara artificial."
    return None

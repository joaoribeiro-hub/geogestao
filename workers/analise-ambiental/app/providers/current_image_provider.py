from __future__ import annotations

from pathlib import Path
from typing import Any
from datetime import datetime, timedelta, timezone

from pyproj import Transformer
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

from app.config import Settings
from app.processing.aoi import AoiResult
from app.processing.layers import EnvironmentalLayer
from app.providers.mapbiomas_real import _measure_geometry
from app.providers.mapbiomas_gee import _download_geotiff, _initialize_earth_engine


class CurrentImageProvider:
    provider_key = "rule_based_ndvi"

    def __init__(self, *, settings: Settings) -> None:
        self.settings = settings

    def is_configured(self) -> bool:
        return self.settings.current_image_provider_enabled

    def analyze(
        self,
        aoi: AoiResult,
        raster_path: str | Path,
        source_options: dict[str, Any] | None = None,
    ) -> tuple[list[EnvironmentalLayer], list[str]]:
        if not self.is_configured():
            return [], ["Motor de imagem atual está desabilitado no worker."]

        import numpy as np
        import rasterio
        from rasterio.features import shapes
        from rasterio.mask import mask

        options = source_options or {}
        nir_band = int(options.get("current_image_nir_band") or self.settings.current_image_nir_band)
        red_band = int(options.get("current_image_red_band") or self.settings.current_image_red_band)
        threshold = float(options.get("ndvi_vegetation_threshold") or self.settings.ndvi_vegetation_threshold)
        with rasterio.open(raster_path) as dataset:
            if dataset.crs is None:
                raise ValueError("GeoTIFF de imagem atual sem CRS.")
            if dataset.count < max(nir_band, red_band):
                return [], [
                    f"Imagem atual possui {dataset.count} banda(s); NDVI requer bandas NIR={nir_band} e Red={red_band}. "
                    "Imagem RGB não será tratada como vegetação precisa."
                ]
            raster_crs = dataset.crs.to_string()
            aoi_raster = _transform_geometry(aoi.geometry, "EPSG:4326", raster_crs)
            clipped, transform_affine = mask(
                dataset,
                [aoi_raster.__geo_interface__],
                indexes=[red_band, nir_band],
                crop=True,
                filled=True,
                nodata=dataset.nodata,
            )
            red = clipped[0].astype("float32")
            nir = clipped[1].astype("float32")
            denominator = nir + red
            valid = np.isfinite(red) & np.isfinite(nir) & (np.abs(denominator) > 1e-6)
            ndvi = np.zeros_like(red, dtype="float32")
            ndvi[valid] = (nir[valid] - red[valid]) / denominator[valid]
            vegetation_mask = valid & (ndvi >= threshold)
            exposed_mask = valid & (ndvi >= -0.05) & (ndvi < threshold)
            layers: list[EnvironmentalLayer] = []
            vegetation = _mask_geometry(vegetation_mask, transform_affine, raster_crs, aoi.geometry)
            if not vegetation.is_empty:
                layers.append(_layer(
                    "vegetacao_imagem_atual", "Vegetação na imagem atual", vegetation, aoi,
                    threshold=threshold, source_options=options,
                ))
            exposed = _mask_geometry(exposed_mask, transform_affine, raster_crs, aoi.geometry)
            if not exposed.is_empty:
                layers.append(_layer(
                    "solo_exposto_imagem_atual", "Solo exposto/baixa resposta vegetal na imagem atual", exposed, aoi,
                    threshold=threshold, source_options=options, confidence=0.55,
                ))
            return layers, []


class DynamicWorldProvider:
    provider_key = "dynamic_world"
    class_bands = ["water", "trees", "grass", "flooded_vegetation", "crops", "shrub_and_scrub", "built", "bare", "snow_and_ice"]

    def __init__(self, *, settings: Settings, tmp_dir: Path) -> None:
        self.settings = settings
        self.tmp_dir = tmp_dir

    def is_configured(self) -> bool:
        return bool(
            self.settings.dynamic_world_enabled
            and self.settings.gee_project_id
            and (self.settings.gee_service_account_json_base64 or (self.settings.gee_service_account_email and self.settings.gee_private_key))
        )

    def analyze(self, aoi: AoiResult) -> tuple[list[EnvironmentalLayer], list[str]]:
        if not self.is_configured():
            return [], ["Dynamic World/GEE não configurado no worker."]
        try:
            raster = self._download(aoi)
            return self._vectorize(raster, aoi), []
        except Exception as exc:
            return [], [f"Falha ao consultar Dynamic World/GEE: {exc}"]

    def _download(self, aoi: AoiResult) -> Path:
        ee = _initialize_earth_engine(self.settings)
        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=90)
        collection = (
            ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
            .filterBounds(ee.Geometry(aoi.geometry_geojson))
            .filterDate(start.isoformat(), end.isoformat())
        )
        probabilities = collection.select(self.class_bands).mean()
        label = probabilities.toArray().arrayArgmax().arrayGet([0]).rename("label")
        confidence = probabilities.reduce(ee.Reducer.max())
        classified = label.updateMask(confidence.gte(self.settings.dynamic_world_min_probability)).clip(ee.Geometry(aoi.geometry_geojson))
        url = classified.getDownloadURL({"name": "dynamic_world", "region": aoi.geometry_geojson, "scale": 10, "crs": "EPSG:4326", "format": "GEO_TIFF"})
        return _download_geotiff(url, self.tmp_dir)

    def _vectorize(self, raster_path: Path, aoi: AoiResult) -> list[EnvironmentalLayer]:
        import numpy as np
        import rasterio
        from rasterio.features import shapes
        from rasterio.mask import mask

        groups = {
            "agua_imagem_atual": ("Água na imagem atual", {0}, 0.75),
            "vegetacao_imagem_atual": ("Vegetação na imagem atual", {1, 2, 3, 5}, 0.75),
            "agropecuaria_imagem_atual": ("Agropecuária na imagem atual", {4}, 0.75),
            "solo_exposto_imagem_atual": ("Solo exposto na imagem atual", {7}, 0.70),
        }
        result: list[EnvironmentalLayer] = []
        with rasterio.open(raster_path) as dataset:
            raster_crs = dataset.crs.to_string()
            clipped, affine = mask(dataset, [_transform_geometry(aoi.geometry, "EPSG:4326", raster_crs).__geo_interface__], crop=True, filled=True, nodata=255)
            band = clipped[0]
            for key, (name, codes, confidence) in groups.items():
                selected = np.isin(band, list(codes))
                geometry = _mask_geometry(selected, affine, raster_crs, aoi.geometry)
                if geometry.is_empty:
                    continue
                metrics = _measure_geometry(geometry, aoi.metric_crs)
                result.append(EnvironmentalLayer(
                    key=key, name=name, geometry=geometry, provider=self.provider_key, confidence="alta",
                    official_data=False, area_ha=metrics["area_ha"], length_m=metrics["length_m"],
                    metadata={"method": "dynamic_world", "confidence_score": confidence, "minimum_probability": self.settings.dynamic_world_min_probability, "period_days": 90},
                ))
        return result


def _mask_geometry(mask_array: Any, affine: Any, raster_crs: str, aoi_geometry: BaseGeometry) -> BaseGeometry:
    import numpy as np
    from rasterio.features import shapes

    if not bool(mask_array.any()):
        from shapely.geometry import GeometryCollection
        return GeometryCollection()
    geometries = [shape(geometry) for geometry, value in shapes(mask_array.astype("uint8"), mask=mask_array, transform=affine) if int(value) == 1]
    merged = unary_union(geometries)
    return _transform_geometry(merged, raster_crs, "EPSG:4326").intersection(aoi_geometry).buffer(0)


def _layer(
    key: str,
    name: str,
    geometry: BaseGeometry,
    aoi: AoiResult,
    *,
    threshold: float,
    source_options: dict[str, Any],
    confidence: float = 0.65,
) -> EnvironmentalLayer:
    metrics = _measure_geometry(geometry, aoi.metric_crs)
    return EnvironmentalLayer(
        key=key,
        name=name,
        geometry=geometry,
        provider="rule_based_ndvi",
        confidence="média" if confidence >= 0.65 else "baixa",
        official_data=False,
        area_ha=metrics["area_ha"],
        length_m=metrics["length_m"],
        metadata={
            "method": "rule_based_ndvi",
            "ndvi_threshold": threshold,
            "confidence_score": confidence,
            "source": source_options.get("current_image_source") or "geotiff",
            "warning": "Classificação indicativa por NDVI; não substitui revisão técnica.",
        },
    )


def _transform_geometry(geometry: BaseGeometry, source_crs: str, target_crs: str) -> BaseGeometry:
    if source_crs == target_crs:
        return geometry
    transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
    return transform(transformer.transform, geometry)

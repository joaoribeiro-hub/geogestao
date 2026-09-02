from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_bounds
from shapely.geometry import box, mapping

from app.config import get_settings
from app.processing.aoi import AoiResult
from app.providers.current_image_provider import CurrentImageProvider
from app.providers.vegetation_model_provider import vegetation_model_catalog


def test_current_image_provider_calculates_ndvi(tmp_path, monkeypatch):
    raster = tmp_path / "current.tif"
    transform = from_bounds(-50, -20, -49.9, -19.9, 10, 10)
    bands = np.zeros((4, 10, 10), dtype="float32")
    bands[2, :, :] = 0.2
    bands[3, :, :] = 0.8
    with rasterio.open(raster, "w", driver="GTiff", width=10, height=10, count=4, dtype="float32", crs="EPSG:4326", transform=transform) as dataset:
        dataset.write(bands)
    monkeypatch.setenv("CURRENT_IMAGE_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("CURRENT_IMAGE_RED_BAND", "3")
    monkeypatch.setenv("CURRENT_IMAGE_NIR_BAND", "4")
    get_settings.cache_clear()
    geometry = box(-50, -20, -49.9, -19.9)
    area = AoiResult(geometry=geometry, geometry_geojson=mapping(geometry), bbox=list(geometry.bounds), area_m2=1, area_ha=100, metric_crs="EPSG:31982")
    layers, warnings = CurrentImageProvider(settings=get_settings()).analyze(area, raster)
    assert not warnings
    assert any(layer.key == "vegetacao_imagem_atual" for layer in layers)


def test_future_models_are_explicitly_disabled(monkeypatch):
    monkeypatch.setenv("CUSTOM_VEGETATION_MODEL_ENABLED", "false")
    get_settings.cache_clear()
    catalog = {item["provider"]: item for item in vegetation_model_catalog(get_settings())}
    assert catalog["samgeo_experimental"]["enabled"] is False
    assert catalog["rastervision_future"]["enabled"] is False

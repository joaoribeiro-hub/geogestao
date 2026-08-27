from __future__ import annotations

import zipfile

import pytest

rasterio = pytest.importorskip("rasterio")
pytest.importorskip("geopandas")
pytest.importorskip("shapely")
pytest.importorskip("pyproj")

import numpy as np
from rasterio.transform import from_origin

from app.processing.aoi import parse_aoi_file
from app.processing.exporters import write_geojson, write_kml, write_shapefile_zip
from app.providers.mapbiomas_real import MapBiomasRealProvider


def test_mapbiomas_real_provider_vectorizes_pixel_classes(tmp_path):
    raster_path = tmp_path / "mapbiomas_real.tif"
    _write_sample_raster(raster_path)
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml(), encoding="utf-8")
    aoi = parse_aoi_file(aoi_file)

    layers, warnings = MapBiomasRealProvider(
        raster_source=str(raster_path),
        year=2025,
        collection="coverage_10m",
    ).analyze(aoi, ["vegetacao", "agua"])

    layer_keys = {layer.key for layer in layers}
    assert layer_keys == {"vegetacao_nativa", "agua"}
    assert all(layer.provider == "mapbiomas_real" for layer in layers)
    assert all(layer.official_data for layer in layers)
    assert all((layer.area_ha or 0) > 0 for layer in layers)
    assert any((layer.metadata or {}).get("percent") for layer in layers)
    assert isinstance(warnings, list)


def test_mapbiomas_real_outputs_geojson_kml_and_shp(tmp_path):
    raster_path = tmp_path / "mapbiomas_real.tif"
    _write_sample_raster(raster_path)
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml(), encoding="utf-8")
    aoi = parse_aoi_file(aoi_file)
    layers, _warnings = MapBiomasRealProvider(
        raster_source=str(raster_path),
        year=2025,
        collection="coverage_10m",
    ).analyze(aoi, [])

    assert {item.key for item in layers} == {"vegetacao_nativa", "agropecuaria", "agua"}
    layer = next(item for item in layers if item.key == "vegetacao_nativa")
    geojson = write_geojson(tmp_path / "floresta.geojson", layer.geometry.__geo_interface__)
    kml = write_kml(tmp_path / "floresta.kml", layer.geometry, layer.name)
    shp_zip = write_shapefile_zip(tmp_path / "floresta.shp.zip", layer.geometry, {"layer": layer.key})

    assert geojson.exists()
    assert "<kml" in kml.read_text(encoding="utf-8")
    with zipfile.ZipFile(shp_zip) as archive:
        names = set(archive.namelist())
        assert any(name.endswith(".shp") for name in names)
        assert any(name.endswith(".dbf") for name in names)


def _write_sample_raster(path):
    data = np.array(
        [
            [3, 3, 15, 15, 33, 33],
            [3, 3, 15, 15, 33, 33],
            [4, 4, 19, 19, 25, 25],
            [4, 4, 19, 19, 25, 25],
            [12, 12, 21, 21, 23, 23],
            [12, 12, 21, 21, 23, 23],
        ],
        dtype="uint8",
    )
    transform = from_origin(-48.0, -16.0, 0.01, 0.01)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=data.shape[0],
        width=data.shape[1],
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
        nodata=0,
    ) as dataset:
        dataset.write(data, 1)


def _kml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon>
<outerBoundaryIs><LinearRing><coordinates>
-48.0,-16.0,0 -47.94,-16.0,0 -47.94,-16.06,0 -48.0,-16.06,0 -48.0,-16.0,0
</coordinates></LinearRing></outerBoundaryIs>
</Polygon></Placemark></Document></kml>"""

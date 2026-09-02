from pathlib import Path
import json

import geopandas as gpd
from shapely.geometry import box, mapping

from app.config import get_settings
from app.processing.aoi import AoiResult
from app.providers.car_provider import CarProvider
from app.tools.prepare_car_base import prepare_car_base


def aoi() -> AoiResult:
    geometry = box(-50, -20, -49.9, -19.9)
    return AoiResult(geometry=geometry, geometry_geojson=mapping(geometry), bbox=list(geometry.bounds), area_m2=1, area_ha=100, metric_crs="EPSG:31982")


def configure(monkeypatch, manifest: Path, cache: Path, max_mb: str = "300"):
    monkeypatch.setenv("CAR_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("CAR_PROVIDER_MODE", "manifest")
    monkeypatch.setenv("CAR_SOURCE_MANIFEST_URL", str(manifest))
    monkeypatch.setenv("CAR_CACHE_DIR", str(cache))
    monkeypatch.setenv("CAR_MAX_DOWNLOAD_MB", max_mb)
    get_settings.cache_clear()


def test_car_provider_reads_local_manifest_and_clips(tmp_path, monkeypatch):
    layer_path = tmp_path / "vegetacao.fgb"
    gpd.GeoDataFrame([{"id": 1}], geometry=[box(-49.98, -19.98, -49.92, -19.92)], crs="EPSG:4326").to_file(layer_path, driver="FlatGeobuf")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"version": "2024", "car": {"go": {"2024": {"5208707": {"vegetacao_car_declarada": {"format": "fgb", "path": str(layer_path)}}}}}}), encoding="utf-8")
    configure(monkeypatch, manifest, tmp_path / "cache")
    layers, warnings, version = CarProvider(settings=get_settings()).analyze(aoi(), [], {"car_uf": "go", "car_year": "2024", "car_municipality_code": "5208707"})
    assert not warnings
    assert version == "2024"
    assert layers[0].key == "vegetacao_car_declarada"


def test_car_provider_blocks_large_declared_file(tmp_path, monkeypatch):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"car": {"go": {"2024": {"5208707": {"vegetacao_car_declarada": {"url": "https://invalid.example/layer.fgb", "size_bytes": 2_000_000}}}}}}), encoding="utf-8")
    configure(monkeypatch, manifest, tmp_path / "cache", max_mb="1")
    layers, warnings, _ = CarProvider(settings=get_settings()).analyze(aoi(), [], {"car_uf": "go", "car_year": "2024", "car_municipality_code": "5208707"})
    assert not layers
    assert "CAR_MAX_DOWNLOAD_MB" in warnings[0]


def test_prepare_car_base_generates_fgb_and_manifest(tmp_path):
    source = tmp_path / "source.geojson"
    gpd.GeoDataFrame([{"municipio": "5208707"}], geometry=[box(-49.98, -19.98, -49.92, -19.92)], crs="EPSG:4326").to_file(source, driver="GeoJSON")
    manifest = prepare_car_base(source, tmp_path / "prepared", uf="go", year="2024", layer="vegetacao_car_declarada", municipality_column="municipio")
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    entry = payload["car"]["go"]["2024"]["5208707"]["vegetacao_car_declarada"]
    assert entry["format"] == "fgb"
    assert Path(entry["url"]).exists()

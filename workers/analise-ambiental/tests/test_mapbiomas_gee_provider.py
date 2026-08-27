from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("shapely")
pytest.importorskip("pyproj")

from app.config import Settings
from app.processing.aoi import parse_aoi_file
from app.providers.mapbiomas_gee import MapBiomasGeeProvider


def test_mapbiomas_gee_without_configuration_returns_friendly_warning(tmp_path):
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml(), encoding="utf-8")
    aoi = parse_aoi_file(aoi_file)

    layers, warnings, provider_key = MapBiomasGeeProvider(settings=_settings(tmp_path), tmp_dir=tmp_path).analyze(aoi, [])

    assert layers == []
    assert provider_key == "mapbiomas_gee"
    assert "Provider MapBiomas/GEE não configurado no worker" in warnings[0]


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        supabase_url="",
        supabase_service_role_key="",
        worker_secret="secret",
        storage_bucket="documentos",
        tmp_dir=tmp_path,
        local_fixture_enabled=False,
        local_fixture_dir=tmp_path,
        provider="mapbiomas_gee",
        mapbiomas_raster_url="",
        mapbiomas_raster_local_path="",
        mapbiomas_year=2025,
        mapbiomas_collection="coverage_10m",
        mapbiomas_asset_id="",
        gee_project_id="",
        gee_service_account_email="",
        gee_private_key="",
        gee_service_account_json_base64="",
        gee_enabled=False,
        hidro_provider="",
        ana_bho6_trecho_drenagem_url="",
        ana_bho6_trecho_drenagem_path="",
        ana_bho6_curso_dagua_url="",
        ana_bho6_area_drenagem_url="",
        ana_massas_dagua_url="",
        ana_hidro_cache_dir=tmp_path / "ana",
        ana_hidro_enable_arcgis_fallback=False,
        poll_enabled=False,
        poll_interval_seconds=60,
        poll_limit=3,
        debug=False,
    )


def _kml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon>
<outerBoundaryIs><LinearRing><coordinates>
-48.0,-16.0,0 -47.9,-16.0,0 -47.9,-16.1,0 -48.0,-16.1,0 -48.0,-16.0,0
</coordinates></LinearRing></outerBoundaryIs>
</Polygon></Placemark></Document></kml>"""
